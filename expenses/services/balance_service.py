from decimal import Decimal
from django.db.models import Sum
from expenses.models import User, Expense, ExpenseSplit, Settlement

def calculate_balances():
    """
    Calculates the net balance for each user.
    For every Expense:
      - The payer receives credit for the full amount paid.
      - Every ExpenseSplit participant owes their share (negative balance).
    For every Settlement:
      - The payer of the settlement receives a positive adjustment (reducing debt).
      - The receiver of the settlement receives a negative adjustment (reducing credit).
    The sum of all balances must always equal zero.
    """
    balances = {}
    users = User.objects.all()
    for user in users:
        balances[user.name] = Decimal('0.00')

    # 1. Payer credit for the full amount paid
    expenses = Expense.objects.all()
    for expense in expenses:
        payer_name = expense.paid_by.name
        if payer_name not in balances:
            balances[payer_name] = Decimal('0.00')
        balances[payer_name] += expense.amount

    # 2. Every ExpenseSplit participant owes their share
    splits = ExpenseSplit.objects.all()
    for split in splits:
        user_name = split.user.name
        if user_name not in balances:
            balances[user_name] = Decimal('0.00')
        balances[user_name] -= split.amount_owed

    # 3. Factor in settlements
    settlements = Settlement.objects.all()
    for settlement in settlements:
        payer_name = settlement.payer.name
        receiver_name = settlement.receiver.name
        if payer_name not in balances:
            balances[payer_name] = Decimal('0.00')
        if receiver_name not in balances:
            balances[receiver_name] = Decimal('0.00')
        
        balances[payer_name] += settlement.amount
        balances[receiver_name] -= settlement.amount

    # Quantize everything to 2 decimal places
    return {name: bal.quantize(Decimal('0.01')) for name, bal in balances.items()}


def generate_settlements(balances):
    """
    Implements a greedy Debt Simplification Algorithm.
    Minimizes the number of transactions by matching the largest debtors 
    with the largest creditors until all balances become zero.
    """
    active_balances = {}
    for name, bal in balances.items():
        dec_bal = Decimal(str(bal)).quantize(Decimal('0.01'))
        if dec_bal != Decimal('0.00'):
            active_balances[name] = dec_bal

    debtors = []
    creditors = []

    for name, bal in active_balances.items():
        if bal < 0:
            debtors.append({'name': name, 'balance': bal})
        else:
            creditors.append({'name': name, 'balance': bal})

    # Sort debtors ascending (most negative first)
    debtors.sort(key=lambda x: x['balance'])
    # Sort creditors descending (most positive first)
    creditors.sort(key=lambda x: x['balance'], reverse=True)

    settlements = []
    debt_idx = 0
    cred_idx = 0

    while debt_idx < len(debtors) and cred_idx < len(creditors):
        debtor = debtors[debt_idx]
        creditor = creditors[cred_idx]

        owe_amount = -debtor['balance']
        credit_amount = creditor['balance']

        settle_amount = min(owe_amount, credit_amount)

        if settle_amount > Decimal('0.00'):
            settlements.append({
                "from": debtor['name'],
                "to": creditor['name'],
                "amount": float(settle_amount.quantize(Decimal('0.01')))
            })

            debtor['balance'] += settle_amount
            creditor['balance'] -= settle_amount

        # Move to next debtor/creditor if their balance is fully settled (0.00)
        if debtor['balance'].quantize(Decimal('0.01')) == Decimal('0.00'):
            debt_idx += 1
        if creditor['balance'].quantize(Decimal('0.01')) == Decimal('0.00'):
            cred_idx += 1

    return settlements
