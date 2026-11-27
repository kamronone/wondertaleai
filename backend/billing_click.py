"""Internal Click protocol helpers; no routes or payment mutations."""
import hashlib
import hmac
import re
from decimal import Decimal

def amount_minor(value: str) -> int:
    if not isinstance(value,str) or not re.fullmatch(r"[0-9]{1,12}(?:\.[0-9]{1,2})?",value):
        raise ValueError("Invalid amount")
    result = int(Decimal(value)*100)
    if result <= 0:
        raise ValueError("Invalid amount")
    return result

def verify_callback(params: dict, service_id: str, secret: str, action: int) -> bool:
    """Preserve original form strings for provider-defined MD5 signature."""
    if not secret or not service_id or action not in (0,1):
        return False
    keys = ["click_trans_id","service_id","merchant_trans_id","amount","action","sign_time","sign_string"]
    if action == 1:
        keys.append("merchant_prepare_id")
    if any(not isinstance(params.get(k),str) or not params[k] or len(params[k])>256 for k in keys):
        return False
    if params["service_id"] != service_id or params["action"] != str(action):
        return False
    if not re.fullmatch(r"[0-9a-fA-F]{32}",params["sign_string"]):
        return False
    try:
        amount_minor(params["amount"])
    except ValueError:
        return False
    parts = [params["click_trans_id"],service_id,secret,params["merchant_trans_id"]]
    if action == 1:
        parts.append(params["merchant_prepare_id"])
    parts.extend([params["amount"],params["action"],params["sign_time"]])
    expected = hashlib.md5("".join(parts).encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected,params["sign_string"].lower())
