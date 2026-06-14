from rest_framework import generics

from .models import *
from .serializers import *


import pandas as pd

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


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
                status=400
            )

        try:

            df = pd.read_excel(uploaded_file)

            print(df.head())

            return Response({
                "message": "File loaded",
                "rows": len(df)
            })

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=500
            )