import hashlib
import pytest
from billing_click import amount_minor, verify_callback, prepare, complete
from datetime import datetime, timezone

SECRET="local-test-secret"
SERVICE="123"
def signed(action):
    p={"click_trans_id":"12345","service_id":SERVICE,
       "merchant_trans_id":"12345678-1234-4234-8234-123456789abc",
       "amount":"39000.00","action":str(action),"sign_time":"2026-11-27 12:00:00",
       "merchant_prepare_id":"12","error":"0"}
    fields=[p["click_trans_id"],SERVICE,SECRET,p["merchant_trans_id"]]
    if action==1:
        fields.append(p["merchant_prepare_id"])
    fields.extend([p["amount"],p["action"],p["sign_time"]])
    p["sign_string"]=hashlib.md5("".join(fields).encode()).hexdigest()
    return p

@pytest.mark.parametrize("action",[0,1])
def test_signature(action):
    p=signed(action)
    assert verify_callback(p,SERVICE,SECRET,action)
    assert not verify_callback(p,SERVICE,"wrong",action)
    p["amount"]="79000.00"
    assert not verify_callback(p,SERVICE,SECRET,action)

@pytest.mark.parametrize("value,expected",[("39000",3900000),("79000.00",7900000),("0.01",1)])
def test_amount(value,expected):
    assert amount_minor(value)==expected

@pytest.mark.parametrize("value",["0","-1","1.001","1e3","NaN"," 1","1,00",None])
def test_invalid_amount(value):
    with pytest.raises(ValueError):
        amount_minor(value)

def test_prepare_rejects_before_database():
    p=signed(0)
    p["sign_string"]="0"*32
    assert prepare(None,p,SERVICE,SECRET)["error"]==-1

def test_complete_rejects_before_database():
    p=signed(1)
    p["merchant_prepare_id"]="13"
    assert complete(None,p,SERVICE,SECRET,datetime.now(timezone.utc))["error"]==-1
