import io
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile
import pandas as pd

from .models import User, Expense, ExpenseSplit, ImportAnomaly
from .utils import normalize_name, clean_amount, is_valid_name, normalize_description
from .services.balance_service import calculate_balances, generate_settlements


class ExpenseTrackerUtilsTestCase(TestCase):
    """
    Tests the utility functions for name normalization, amount cleaning,
    name validation, and description normalization.
    """

    def test_normalize_name(self):
        self.assertEqual(normalize_name("Priya"), "Priya")
        self.assertEqual(normalize_name("priya"), "Priya")
        self.assertEqual(normalize_name("Priya S"), "Priya")
        self.assertEqual(normalize_name("priya s"), "Priya")
        self.assertEqual(normalize_name("  aisha  "), "Aisha")
        self.assertEqual(normalize_name("john doe"), "John Doe")
        self.assertEqual(normalize_name(None), "")
        self.assertEqual(normalize_name(float('nan')), "")

    def test_clean_amount(self):
        self.assertEqual(clean_amount("1,200"), Decimal("1200.00"))
        self.assertEqual(clean_amount("899.995"), Decimal("900.00"))
        self.assertEqual(clean_amount(150.456), Decimal("150.46"))
        with self.assertRaises(ValueError):
            clean_amount("invalid_amount")
        with self.assertRaises(ValueError):
            clean_amount(None)

    def test_is_valid_name(self):
        self.assertTrue(is_valid_name("Priya"))
        self.assertTrue(is_valid_name("John Doe"))
        self.assertFalse(is_valid_name("A"))
        self.assertFalse(is_valid_name("123"))
        self.assertFalse(is_valid_name(""))
        self.assertFalse(is_valid_name(None))

    def test_normalize_description(self):
        self.assertEqual(
            normalize_description("Dinner at Marina Bites"),
            "dinner marina bites"
        )
        self.assertEqual(
            normalize_description("dinner - marina bites"),
            "dinner marina bites"
        )
        self.assertEqual(
            normalize_description("Lunch with friends"),
            "lunch friends"
        )
        self.assertEqual(normalize_description(None), "")


class ImportExpenseViewTestCase(APITestCase):
    """
    Tests the ImportExpenseView by generating Excel files in memory and sending
    POST requests to verify successful imports and anomaly recording.
    """

    def setUp(self):
        self.url = reverse('import-expenses')

    def _generate_excel_file(self, data):
        df = pd.DataFrame(data)
        out = io.BytesIO()
        df.to_excel(out, index=False)
        out.seek(0)
        return SimpleUploadedFile(
            "test_import.xlsx",
            out.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    def test_successful_import_equal_split(self):
        # 1. Test standard import with equal split
        data = {
            "date": ["2026-06-14"],
            "description": ["Dinner at Marina Bites"],
            "paid_by": ["priya s"],
            "amount": ["1,200"],
            "currency": ["INR"],
            "split_type": ["equal"],
            "split_with": ["Aisha, Rohan"],
            "split_details": [None],
            "notes": ["Team Dinner"]
        }
        excel_file = self._generate_excel_file(data)
        
        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        res_data = response.data
        self.assertEqual(res_data["rows_processed"], 1)
        self.assertEqual(res_data["users_created"], 3)  # Priya, Aisha, Rohan
        self.assertEqual(res_data["expenses_created"], 1)
        self.assertEqual(res_data["duplicates_found"], 0)
        self.assertEqual(res_data["anomalies_found"], 0)

        # Verify database objects
        expense = Expense.objects.first()
        self.assertIsNotNone(expense)
        self.assertEqual(expense.description, "Dinner at Marina Bites")
        self.assertEqual(expense.paid_by.name, "Priya")
        self.assertEqual(expense.amount, Decimal("1200.00"))
        
        # Check equal splits (1200 / 3 = 400.00 each)
        splits = ExpenseSplit.objects.filter(expense=expense)
        self.assertEqual(splits.count(), 3)
        for split in splits:
            self.assertEqual(split.amount_owed, Decimal("400.00"))

    def test_successful_import_unequal_split(self):
        # 2. Test standard import with unequal split
        data = {
            "date": ["2026-06-14"],
            "description": ["Cab Ride"],
            "paid_by": ["Rohan"],
            "amount": ["900.00"],
            "currency": ["INR"],
            "split_type": ["unequal"],
            "split_with": [None],
            "split_details": ["Aisha:500, Rohan:400"],
            "notes": ["Commute"]
        }
        excel_file = self._generate_excel_file(data)

        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        res_data = response.data
        self.assertEqual(res_data["rows_processed"], 1)
        self.assertEqual(res_data["users_created"], 2)  # Rohan, Aisha
        self.assertEqual(res_data["expenses_created"], 1)
        self.assertEqual(res_data["anomalies_found"], 0)

        expense = Expense.objects.get(description="Cab Ride")
        splits = ExpenseSplit.objects.filter(expense=expense).order_counts_by_name = list(
            ExpenseSplit.objects.filter(expense=expense).values_list('user__name', 'amount_owed')
        )
        self.assertIn(("Aisha", Decimal("500.00")), splits)
        self.assertIn(("Rohan", Decimal("400.00")), splits)

    def test_semicolon_separated_split_with(self):
        data = {
            "date": ["2026-06-14"],
            "description": ["Dinner"],
            "paid_by": ["Priya"],
            "amount": ["4000"],
            "currency": ["INR"],
            "split_type": ["equal"],
            "split_with": ["Aisha;Rohan;Priya;Meera"],
            "split_details": [None],
            "notes": ["Semicolons test"]
        }
        excel_file = self._generate_excel_file(data)
        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Priya, Aisha, Rohan, Meera
        self.assertEqual(response.data["users_created"], 4)
        self.assertEqual(response.data["expenses_created"], 1)
        self.assertEqual(response.data["anomalies_found"], 0)
        
        # Verify 4 distinct users are in DB
        self.assertEqual(User.objects.count(), 4)
        self.assertTrue(User.objects.filter(name="Aisha").exists())
        self.assertTrue(User.objects.filter(name="Rohan").exists())
        self.assertTrue(User.objects.filter(name="Priya").exists())
        self.assertTrue(User.objects.filter(name="Meera").exists())
        # Check that no user with a semicolon was created
        self.assertFalse(User.objects.filter(name__contains=";").exists())

    def test_comma_separated_split_with(self):
        data = {
            "date": ["2026-06-14"],
            "description": ["Lunch"],
            "paid_by": ["Priya"],
            "amount": ["4000"],
            "currency": ["INR"],
            "split_type": ["equal"],
            "split_with": ["Aisha,Rohan,Priya,Meera"],
            "split_details": [None],
            "notes": ["Commas test"]
        }
        excel_file = self._generate_excel_file(data)
        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["users_created"], 4)
        self.assertEqual(response.data["anomalies_found"], 0)
        self.assertEqual(User.objects.count(), 4)
        self.assertFalse(User.objects.filter(name__contains=",").exists())

    def test_mixed_separators_split_with(self):
        data = {
            "date": ["2026-06-14"],
            "description": ["Coffee"],
            "paid_by": ["Priya"],
            "amount": ["4000"],
            "currency": ["INR"],
            "split_type": ["equal"],
            "split_with": ["Aisha; Rohan, Priya; Meera"],
            "split_details": [None],
            "notes": ["Mixed separators test"]
        }
        excel_file = self._generate_excel_file(data)
        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["users_created"], 4)
        self.assertEqual(response.data["anomalies_found"], 0)
        self.assertEqual(User.objects.count(), 4)

    def test_prevention_of_invalid_combined_usernames(self):
        data = {
            "date": ["2026-06-14"],
            "description": ["Invalid Payer"],
            "paid_by": ["Aisha;Rohan"], # Payer contains semicolon
            "amount": ["1000"],
            "currency": ["INR"],
            "split_type": ["equal"],
            "split_with": ["Priya"],
            "split_details": [None],
            "notes": ["Invalid payer test"]
        }
        excel_file = self._generate_excel_file(data)
        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["expenses_created"], 0)
        self.assertEqual(response.data["anomalies_found"], 1)
        
        # Check anomaly
        anomaly = ImportAnomaly.objects.first()
        self.assertEqual(anomaly.anomaly_type, "invalid_user")
        self.assertIn("cannot contain comma or semicolon", anomaly.description)

    def test_unequal_split_parsing_both_formats(self):
        # Rohan 700; Priya 400; Meera 400
        data = {
            "date": ["2026-06-14"],
            "description": ["Cab Ride"],
            "paid_by": ["Rohan"],
            "amount": ["1500.00"],
            "currency": ["INR"],
            "split_type": ["unequal"],
            "split_with": [None],
            "split_details": ["Aisha 700; Rohan 400; Priya 400"],
            "notes": ["Commute"]
        }
        excel_file = self._generate_excel_file(data)
        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["expenses_created"], 1)
        self.assertEqual(response.data["anomalies_found"], 0)
        
        expense = Expense.objects.get(description="Cab Ride")
        splits = list(
            ExpenseSplit.objects.filter(expense=expense).values_list('user__name', 'amount_owed')
        )
        self.assertIn(("Aisha", Decimal("700.00")), splits)
        self.assertIn(("Rohan", Decimal("400.00")), splits)
        self.assertIn(("Priya", Decimal("400.00")), splits)

    def test_duplicate_handling(self):
        # Create an initial expense in the DB
        payer = User.objects.create(name="Priya")
        Expense.objects.create(
            description="Dinner at Marina Bites",
            paid_by=payer,
            amount=Decimal("1200.00"),
            currency="INR",
            date="2026-06-14",
            split_type="equal"
        )

        # Try to import a duplicate expense
        data = {
            "date": ["2026-06-14"],
            "description": ["dinner - marina bites"],  # duplicate normalized description
            "paid_by": ["Priya"],
            "amount": ["1,200"],
            "currency": ["INR"],
            "split_type": ["equal"],
            "split_with": ["Aisha, Rohan"],
            "split_details": [None],
            "notes": ["Team Dinner"]
        }
        excel_file = self._generate_excel_file(data)

        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        res_data = response.data
        self.assertEqual(res_data["rows_processed"], 1)
        self.assertEqual(res_data["expenses_created"], 0)
        self.assertEqual(res_data["duplicates_found"], 1)
        self.assertEqual(res_data["anomalies_found"], 0)

        # Check that ImportAnomaly record was created
        anomaly = ImportAnomaly.objects.first()
        self.assertEqual(anomaly.anomaly_type, "duplicate")
        self.assertEqual(anomaly.row_number, 2)

    def test_anomaly_detection_invalid_amount_and_users(self):
        data = {
            "date": ["2026-06-14", "2026-06-14", "2026-06-14"],
            "description": ["Invalid Amount Expense", "Invalid Payer Expense", "Invalid Split Sum"],
            "paid_by": ["Priya", "123", "Aisha"],
            "amount": ["invalid_amt", "500", "1,000"],
            "currency": ["INR", "INR", "INR"],
            "split_type": ["equal", "equal", "unequal"],
            "split_with": ["Aisha", "Rohan", None],
            "split_details": [None, None, "Aisha:400, Rohan:500"],  # sum=900, doesn't match 1000
            "notes": [None, None, None]
        }
        excel_file = self._generate_excel_file(data)

        response = self.client.post(self.url, {"file": excel_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        res_data = response.data
        self.assertEqual(res_data["rows_processed"], 3)
        self.assertEqual(res_data["expenses_created"], 0)
        self.assertEqual(res_data["anomalies_found"], 3)

        anomalies = list(ImportAnomaly.objects.all().values_list('row_number', 'anomaly_type'))
        self.assertIn((2, "invalid_amount"), anomalies)
        self.assertIn((3, "invalid_user"), anomalies)
        self.assertIn((4, "invalid_amount"), anomalies)


class BalanceCalculationEngineTestCase(TestCase):

    def setUp(self):
        # Create test users
        self.aisha = User.objects.create(name="Aisha")
        self.rohan = User.objects.create(name="Rohan")
        self.priya = User.objects.create(name="Priya")
        self.meera = User.objects.create(name="Meera")

    def test_single_expense_equal_split(self):
        # Aisha paid 4000. Equal split between Aisha, Rohan, Priya, Meera.
        expense = Expense.objects.create(
            description="Dinner",
            paid_by=self.aisha,
            amount=Decimal("4000.00"),
            currency="INR",
            date="2026-06-14",
            split_type="equal"
        )
        users = [self.aisha, self.rohan, self.priya, self.meera]
        for u in users:
            ExpenseSplit.objects.create(
                expense=expense,
                user=u,
                amount_owed=Decimal("1000.00")
            )
        
        balances = calculate_balances()
        
        # Expect Aisha: +3000, others: -1000
        self.assertEqual(balances["Aisha"], Decimal("3000.00"))
        self.assertEqual(balances["Rohan"], Decimal("-1000.00"))
        self.assertEqual(balances["Priya"], Decimal("-1000.00"))
        self.assertEqual(balances["Meera"], Decimal("-1000.00"))
        
        # Verify sum of balances equals zero
        self.assertEqual(sum(balances.values()), Decimal("0.00"))
        
        # Verify recommended settlements
        settlements = generate_settlements(balances)
        # 3 settlements: Rohan -> Aisha (1000), Priya -> Aisha (1000), Meera -> Aisha (1000)
        self.assertEqual(len(settlements), 3)
        for s in settlements:
            self.assertEqual(s["to"], "Aisha")
            self.assertEqual(s["amount"], 1000.0)

    def test_multiple_expenses_unequal_splits(self):
        # 1. Rohan paid 900.00. Unequal split: Aisha 500.00, Rohan 400.00.
        expense1 = Expense.objects.create(
            description="Cab",
            paid_by=self.rohan,
            amount=Decimal("900.00"),
            currency="INR",
            date="2026-06-14",
            split_type="unequal"
        )
        ExpenseSplit.objects.create(expense=expense1, user=self.aisha, amount_owed=Decimal("500.00"))
        ExpenseSplit.objects.create(expense=expense1, user=self.rohan, amount_owed=Decimal("400.00"))
        
        # Rohan net after expense1: +500.00. Aisha net after expense1: -500.00.
        
        # 2. Priya paid 1500.00. Equal split: Aisha, Rohan, Priya.
        expense2 = Expense.objects.create(
            description="Lunch",
            paid_by=self.priya,
            amount=Decimal("1500.00"),
            currency="INR",
            date="2026-06-14",
            split_type="equal"
        )
        ExpenseSplit.objects.create(expense=expense2, user=self.aisha, amount_owed=Decimal("500.00"))
        ExpenseSplit.objects.create(expense=expense2, user=self.rohan, amount_owed=Decimal("500.00"))
        ExpenseSplit.objects.create(expense=expense2, user=self.priya, amount_owed=Decimal("500.00"))
        
        # Priya net after expense2: +1000.00. Aisha net: -500.00. Rohan net: -500.00.
        # Cumulative balances:
        # Aisha: -500 - 500 = -1000
        # Rohan: +500 - 500 = 0
        # Priya: +1000
        # Meera: 0
        
        balances = calculate_balances()
        self.assertEqual(balances["Aisha"], Decimal("-1000.00"))
        self.assertEqual(balances["Rohan"], Decimal("0.00"))
        self.assertEqual(balances["Priya"], Decimal("1000.00"))
        self.assertEqual(balances["Meera"], Decimal("0.00"))
        
        self.assertEqual(sum(balances.values()), Decimal("0.00"))
        
        # Settle up: Aisha -> Priya (1000)
        settlements = generate_settlements(balances)
        self.assertEqual(len(settlements), 1)
        self.assertEqual(settlements[0], {
            "from": "Aisha",
            "to": "Priya",
            "amount": 1000.0
        })

    def test_debt_simplification_minimizes_transactions(self):
        # Input like the example: Aisha: 5000, Rohan: -3000, Priya: -2000
        # Let's create an expense to match this:
        # Aisha paid 5000. Splits: Rohan owes 3000, Priya owes 2000.
        expense = Expense.objects.create(
            description="Hotel booking",
            paid_by=self.aisha,
            amount=Decimal("5000.00"),
            currency="INR",
            date="2026-06-14",
            split_type="unequal"
        )
        ExpenseSplit.objects.create(expense=expense, user=self.rohan, amount_owed=Decimal("3000.00"))
        ExpenseSplit.objects.create(expense=expense, user=self.priya, amount_owed=Decimal("2000.00"))
        
        balances = calculate_balances()
        self.assertEqual(balances["Aisha"], Decimal("5000.00"))
        self.assertEqual(balances["Rohan"], Decimal("-3000.00"))
        self.assertEqual(balances["Priya"], Decimal("-2000.00"))
        
        settlements = generate_settlements(balances)
        self.assertEqual(len(settlements), 2)
        # Should be Rohan -> Aisha (3000), Priya -> Aisha (2000)
        self.assertIn({
            "from": "Rohan",
            "to": "Aisha",
            "amount": 3000.0
        }, settlements)
        self.assertIn({
            "from": "Priya",
            "to": "Aisha",
            "amount": 2000.0
        }, settlements)


class BalanceAPITestCase(APITestCase):

    def setUp(self):
        self.aisha = User.objects.create(name="Aisha")
        self.rohan = User.objects.create(name="Rohan")
        self.priya = User.objects.create(name="Priya")

    def test_api_endpoints(self):
        # Aisha paid 5000. Splits: Rohan owes 3000, Priya owes 2000.
        expense = Expense.objects.create(
            description="Hotel",
            paid_by=self.aisha,
            amount=Decimal("5000.00"),
            currency="INR",
            date="2026-06-14",
            split_type="unequal"
        )
        ExpenseSplit.objects.create(expense=expense, user=self.rohan, amount_owed=Decimal("3000.00"))
        ExpenseSplit.objects.create(expense=expense, user=self.priya, amount_owed=Decimal("2000.00"))
        
        # Test GET /api/balances/
        url_balances = reverse('balances')
        response = self.client.get(url_balances)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["Aisha"], 5000.0)
        self.assertEqual(response.data["Rohan"], -3000.0)
        self.assertEqual(response.data["Priya"], -2000.0)
        
        # Test GET /api/recommended-settlements/
        url_settlements = reverse('recommended-settlements')
        response = self.client.get(url_settlements)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertIn({
            "from": "Rohan",
            "to": "Aisha",
            "amount": 3000.0
        }, response.data)
        self.assertIn({
            "from": "Priya",
            "to": "Aisha",
            "amount": 2000.0
        }, response.data)
