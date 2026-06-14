from rest_framework import generics

from .models import *
from .serializers import *


import pandas as pd
import re

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .utils import normalize_name, clean_amount, is_valid_name, normalize_description
from django.db import transaction
from decimal import Decimal, ROUND_HALF_UP
from .services.balance_service import calculate_balances, generate_settlements

class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class GroupListCreateView(generics.ListCreateAPIView):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer


class MembershipListCreateView(generics.ListCreateAPIView):
    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer


class ExpenseListCreateView(generics.ListCreateAPIView):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer


class ExpenseSplitListCreateView(generics.ListCreateAPIView):
    queryset = ExpenseSplit.objects.all()
    serializer_class = ExpenseSplitSerializer


class SettlementListCreateView(generics.ListCreateAPIView):
    queryset = Settlement.objects.all()
    serializer_class = SettlementSerializer


class ImportAnomalyListCreateView(generics.ListCreateAPIView):
    queryset = ImportAnomaly.objects.all()
    serializer_class = ImportAnomalySerializer


class ImportExpenseView(APIView):

    def post(self, request):
        uploaded_file = request.FILES.get("file")

        if not uploaded_file:
            return Response(
                {"error": "No file uploaded"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Read dataframe using pandas
            df = pd.read_excel(uploaded_file)
        except Exception as e:
            return Response(
                {"error": f"Failed to read Excel file: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure required columns are present in DataFrame
        required_cols = ["date", "description", "paid_by", "amount", "currency", "split_type"]
        for col in required_cols:
            if col not in df.columns:
                return Response(
                    {"error": f"Missing required column in Excel: '{col}'"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        rows_processed = 0
        users_created = 0
        expenses_created = 0
        duplicates_found = 0
        anomalies_found = 0

        seen_signatures = set()

        for index, row in df.iterrows():
            rows_processed += 1
            row_num = index + 2  # Excel row number (assuming header is row 1)

            try:
                # 1. Payer validation
                paid_by_raw = row.get("paid_by")
                if pd.isna(paid_by_raw) or not str(paid_by_raw).strip():
                    raise ValueError("invalid_user: Payer name is missing")
                
                if ";" in str(paid_by_raw) or "," in str(paid_by_raw):
                    raise ValueError(f"invalid_user: Username cannot contain comma or semicolon: '{paid_by_raw}'")
                
                payer_name = normalize_name(paid_by_raw)
                if ";" in payer_name or "," in payer_name:
                    raise ValueError(f"invalid_user: Username cannot contain comma or semicolon: '{payer_name}'")
                    
                if not is_valid_name(payer_name):
                    raise ValueError(f"invalid_user: Invalid payer name format: '{paid_by_raw}'")

                # 2. Amount validation
                amount_raw = row.get("amount")
                if pd.isna(amount_raw):
                    raise ValueError("invalid_amount: Amount is missing")
                
                try:
                    cleaned_amount = clean_amount(amount_raw)
                except Exception as e:
                    raise ValueError(f"invalid_amount: {str(e)}")

                if cleaned_amount <= 0:
                    raise ValueError(f"invalid_amount: Amount must be greater than zero, got {cleaned_amount}")

                # 3. Date validation
                date_raw = row.get("date")
                if pd.isna(date_raw):
                    raise ValueError("other: Date is missing")
                
                from datetime import date as datetime_date, datetime
                parsed_date = None
                if isinstance(date_raw, (datetime_date, datetime)):
                    parsed_date = date_raw
                    if isinstance(parsed_date, datetime):
                        parsed_date = parsed_date.date()
                else:
                    try:
                        parsed_date = pd.to_datetime(date_raw).date()
                    except Exception:
                        raise ValueError(f"other: Invalid date format: '{date_raw}'")

                if not parsed_date:
                    raise ValueError(f"other: Invalid date format: '{date_raw}'")

                # 4. Description validation
                description_raw = row.get("description")
                if pd.isna(description_raw) or not str(description_raw).strip():
                    raise ValueError("other: Description is missing")
                description = str(description_raw).strip()

                # 5. Currency validation
                currency_raw = row.get("currency")
                if pd.isna(currency_raw) or not str(currency_raw).strip():
                    raise ValueError("currency_issue: Currency is missing")
                currency_str = str(currency_raw).strip().upper()
                if not currency_str.isalpha() or len(currency_str) != 3:
                    raise ValueError(f"currency_issue: Invalid currency code: '{currency_raw}'")

                # 6. Split Type validation
                split_type_raw = row.get("split_type")
                if pd.isna(split_type_raw) or not str(split_type_raw).strip():
                    raise ValueError("other: Split type is missing")
                split_type = str(split_type_raw).strip().lower()
                if split_type not in ["equal", "unequal"]:
                    raise ValueError(f"other: Invalid split type: '{split_type_raw}'")

                # 7. Duplicate Check
                norm_desc = normalize_description(description)
                signature = (parsed_date, payer_name, cleaned_amount, norm_desc)
                if signature in seen_signatures:
                    raise ValueError(f"duplicate: Duplicate of another row in this file: '{description}'")

                # Check database duplicate
                db_expenses = Expense.objects.filter(
                    date=parsed_date,
                    paid_by__name=payer_name,
                    amount=cleaned_amount
                )
                is_db_dup = False
                for db_exp in db_expenses:
                    if normalize_description(db_exp.description) == norm_desc:
                        is_db_dup = True
                        break
                if is_db_dup:
                    raise ValueError(f"duplicate: Duplicate of existing database expense: '{description}'")

                # Track unique signature in this import session
                seen_signatures.add(signature)

                # 8. Create database records inside transaction
                temp_users_created = 0
                with transaction.atomic():
                    # Payer User
                    payer_user, created_payer = User.objects.get_or_create(name=payer_name)
                    if created_payer:
                        temp_users_created += 1

                    # Expense record
                    notes_raw = row.get("notes")
                    notes = str(notes_raw).strip() if pd.notna(notes_raw) else ""
                    expense_obj = Expense.objects.create(
                        description=description,
                        paid_by=payer_user,
                        amount=cleaned_amount,
                        currency=currency_str,
                        date=parsed_date,
                        split_type=split_type,
                        notes=notes
                    )

                    splits_to_create = []

                    # Equal split creation
                    if split_type == "equal":
                        split_with_raw = row.get("split_with")
                        users_in_split = []
                        if pd.notna(split_with_raw) and str(split_with_raw).strip():
                            parts = [
                                p.strip()
                                for p in re.split(r"[;,]", str(split_with_raw))
                                if p.strip()
                            ]
                            for part in parts:
                                if ";" in part or "," in part:
                                    raise ValueError(f"invalid_user: Username cannot contain comma or semicolon: '{part}'")
                                    
                                norm_part = normalize_name(part)
                                if ";" in norm_part or "," in norm_part:
                                    raise ValueError(f"invalid_user: Username cannot contain comma or semicolon: '{norm_part}'")
                                    
                                if not is_valid_name(norm_part):
                                    raise ValueError(f"invalid_user: Invalid username in split list: '{part}'")
                                users_in_split.append(norm_part)

                        # Union with payer
                        participants = list(set(users_in_split) | {payer_name})
                        if not participants:
                            raise ValueError("invalid_amount: No participants found to split")

                        participant_users = []
                        for name in participants:
                            u_obj, created_u = User.objects.get_or_create(name=name)
                            if created_u:
                                temp_users_created += 1
                            participant_users.append(u_obj)

                        n = len(participant_users)
                        base_split = (cleaned_amount / Decimal(n)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        allocated_sum = base_split * Decimal(n)
                        diff = cleaned_amount - allocated_sum

                        for i, u_obj in enumerate(participant_users):
                            owed = base_split
                            if i == n - 1:
                                owed += diff
                            splits_to_create.append(ExpenseSplit(
                                expense=expense_obj,
                                user=u_obj,
                                amount_owed=owed
                            ))

                    # Unequal split creation
                    elif split_type == "unequal":
                        split_details_raw = row.get("split_details")
                        if pd.isna(split_details_raw) or not str(split_details_raw).strip():
                            raise ValueError("invalid_amount: Missing split details for unequal split")

                        raw_pairs = [
                            p.strip()
                            for p in re.split(r"[;,]", str(split_details_raw))
                            if p.strip()
                        ]
                        participants_data = []
                        total_split_amount = Decimal('0.00')

                        for pair in raw_pairs:
                            if not pair.strip():
                                continue
                            if ":" in pair:
                                name_part, amount_part = pair.split(":", 1)
                            else:
                                parts = pair.strip().rsplit(None, 1)
                                if len(parts) != 2:
                                    raise ValueError(f"invalid_amount: Invalid split detail format '{pair}'")
                                name_part, amount_part = parts
                                
                            name_part = name_part.strip()
                            amount_part = amount_part.strip()

                            if ";" in name_part or "," in name_part:
                                raise ValueError(f"invalid_user: Username cannot contain comma or semicolon: '{name_part}'")

                            norm_name = normalize_name(name_part)
                            if ";" in norm_name or "," in norm_name:
                                raise ValueError(f"invalid_user: Username cannot contain comma or semicolon: '{norm_name}'")

                            if not is_valid_name(norm_name):
                                raise ValueError(f"invalid_user: Invalid username in split details: '{name_part}'")

                            try:
                                owed_amount = clean_amount(amount_part)
                            except Exception as e:
                                raise ValueError(f"invalid_amount: {str(e)} for '{name_part}'")

                            if owed_amount <= 0:
                                raise ValueError(f"invalid_amount: Split amount for '{name_part}' must be greater than zero")

                            participants_data.append((norm_name, owed_amount))
                            total_split_amount += owed_amount

                        if total_split_amount != cleaned_amount:
                            raise ValueError(f"invalid_amount: Sum of split details ({total_split_amount}) does not match expense amount ({cleaned_amount})")

                        for name, owed in participants_data:
                            u_obj, created_u = User.objects.get_or_create(name=name)
                            if created_u:
                                temp_users_created += 1
                            splits_to_create.append(ExpenseSplit(
                                expense=expense_obj,
                                user=u_obj,
                                amount_owed=owed
                            ))

                    # Bulk create splits
                    ExpenseSplit.objects.bulk_create(splits_to_create)

                # Successful row transaction: finalize counters
                users_created += temp_users_created
                expenses_created += 1

            except ValueError as ve:
                err_msg = str(ve)
                anomaly_type = "other"
                desc = err_msg
                if ":" in err_msg:
                    prefix, rest = err_msg.split(":", 1)
                    prefix = prefix.strip()
                    if prefix in ["duplicate", "invalid_user", "invalid_amount", "currency_issue", "other"]:
                        anomaly_type = prefix
                        desc = rest.strip()

                ImportAnomaly.objects.create(
                    row_number=row_num,
                    anomaly_type=anomaly_type,
                    description=desc
                )
                if anomaly_type == "duplicate":
                    duplicates_found += 1
                else:
                    anomalies_found += 1

            except Exception as e:
                ImportAnomaly.objects.create(
                    row_number=row_num,
                    anomaly_type="other",
                    description=f"System error: {str(e)}"
                )
                anomalies_found += 1

        return Response({
            "rows_processed": rows_processed,
            "users_created": users_created,
            "expenses_created": expenses_created,
            "duplicates_found": duplicates_found,
            "anomalies_found": anomalies_found
        }, status=status.HTTP_200_OK)


class BalanceCalculationView(APIView):

    def get(self, request):
        try:
            balances = calculate_balances()
            # Convert decimal values to floats for JSON response
            formatted_balances = {name: float(amount) for name, amount in balances.items()}
            return Response(formatted_balances, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RecommendedSettlementView(APIView):

    def get(self, request):
        try:
            balances = calculate_balances()
            settlements = generate_settlements(balances)
            return Response(settlements, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)