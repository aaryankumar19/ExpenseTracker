from django.contrib import admin
from .models import *

admin.site.register(User)
admin.site.register(Group)
admin.site.register(Membership)
admin.site.register(Expense)
admin.site.register(ExpenseSplit)
admin.site.register(Settlement)
admin.site.register(ImportAnomaly)