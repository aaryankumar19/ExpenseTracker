import pandas as pd
import re
from decimal import Decimal, ROUND_HALF_UP

def normalize_name(name):
    if name is None or (isinstance(name, float) and pd.isna(name)):
        return ""
    
    cleaned = str(name).strip()
    if not cleaned or cleaned.lower() == 'nan':
        return ""
    
    mapping = {
        "priya": "Priya",
        "priya s": "Priya",
        "aisha": "Aisha",
        "rohan": "Rohan",
        "meera": "Meera",
        "dev": "Dev",
        "sam": "Sam"
    }
    
    cleaned_lower = cleaned.lower()
    if cleaned_lower in mapping:
        return mapping[cleaned_lower]
    
    # Standardize spaces and return title case
    return " ".join(cleaned.split()).title()


def clean_amount(amount):
    if amount is None or (isinstance(amount, float) and pd.isna(amount)):
        raise ValueError("Amount is missing or null")
    
    # Convert to string and clean up
    amount_str = str(amount).strip()
    # Remove commas
    amount_str = amount_str.replace(",", "")
    
    # Try converting to Decimal
    try:
        val = Decimal(amount_str)
    except Exception:
        raise ValueError(f"Invalid numeric format: '{amount}'")
    
    # Quantize to 2 decimal places using ROUND_HALF_UP (e.g. 899.995 -> 900.00)
    cleaned_val = val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return cleaned_val


def is_valid_name(name):
    if not name:
        return False
    name_str = str(name).strip()
    # Name must not contain comma or semicolon
    if ";" in name_str or "," in name_str:
        return False
    if len(name_str) < 2:
        return False
    # A valid name should contain at least one alphabet character
    if not re.search(r'[a-zA-Z]', name_str):
        return False
    return True


def normalize_description(desc):
    if not desc or (isinstance(desc, float) and pd.isna(desc)):
        return ""
    
    # Lowercase and replace non-alphanumeric characters with spaces
    desc_str = str(desc).lower()
    desc_str = re.sub(r'[^a-z0-9\s]', ' ', desc_str)
    
    # Tokenize and filter out common stopwords
    tokens = desc_str.split()
    stopwords = {
        'at', 'for', 'in', 'to', 'on', 'the', 'a', 'an', 'and', 'or', 'of', 'with', 
        'from', 'by', 'dash', 'hyphen', 'restaurant', 'hotel', 'cafe'
    }
    filtered = [t for t in tokens if t not in stopwords]
    return " ".join(filtered)