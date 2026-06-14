from django.db import models


class User(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Group(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Membership(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE
    )

    joined_at = models.DateField()

    left_at = models.DateField(
        null=True,
        blank=True
    )

    def __str__(self):
        return f"{self.user.name} - {self.group.name}"


class Expense(models.Model):

    SPLIT_CHOICES = [
        ("equal", "Equal"),
        ("unequal", "Unequal"),
    ]

    description = models.CharField(max_length=255)

    paid_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    currency = models.CharField(
        max_length=10,
        default="INR"
    )

    date = models.DateField()

    split_type = models.CharField(
        max_length=20,
        choices=SPLIT_CHOICES
    )

    notes = models.TextField(
        blank=True,
        null=True
    )

    def __str__(self):
        return self.description


class ExpenseSplit(models.Model):
    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        related_name="splits"
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    amount_owed = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    def __str__(self):
        return f"{self.user.name} owes {self.amount_owed}"


class Settlement(models.Model):
    payer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="payments_made"
    )

    receiver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="payments_received"
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    date = models.DateField()

    def __str__(self):
        return f"{self.payer.name} paid {self.receiver.name}"


class ImportAnomaly(models.Model):

    ANOMALY_TYPES = [
        ("duplicate", "Duplicate Expense"),
        ("invalid_user", "Invalid User"),
        ("invalid_amount", "Invalid Amount"),
        ("currency_issue", "Currency Issue"),
        ("other", "Other"),
    ]

    row_number = models.IntegerField()

    anomaly_type = models.CharField(
        max_length=50,
        choices=ANOMALY_TYPES
    )

    description = models.TextField()

    resolved = models.BooleanField(
        default=False
    )

    def __str__(self):
        return self.anomaly_type