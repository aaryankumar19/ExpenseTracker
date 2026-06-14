from django.urls import path
from .views import *

urlpatterns = [
    path("users/", UserListCreateView.as_view()),

    path("groups/", GroupListCreateView.as_view()),

    path(
        "memberships/",
        MembershipListCreateView.as_view()
    ),

    path(
        "expenses/",
        ExpenseListCreateView.as_view()
    ),

    path(
        "expense-splits/",
        ExpenseSplitListCreateView.as_view()
    ),

    path(
        "settlements/",
        SettlementListCreateView.as_view()
    ),

    path(
        "anomalies/",
        ImportAnomalyListCreateView.as_view()
    ),
    path(
    "import-expenses/",
    ImportExpenseView.as_view()
),
]