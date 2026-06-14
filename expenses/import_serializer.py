from rest_framework import serializers


class ExpenseImportSerializer(serializers.Serializer):
    file = serializers.FileField()