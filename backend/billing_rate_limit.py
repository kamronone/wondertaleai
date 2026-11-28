"""Optional distributed limiter; not connected to production or sandbox routes."""
import hashlib
from uuid import uuid4

_SCRIPT = """
local t=redis.call('TIME')
local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
local window=tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now-window)
if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[2]) then
  local first=redis.call('ZRANGE',KEYS[1],0,0,'WITHSCORES')
  return math.max(1,math.ceil((tonumber(first[2])+window-now)/1000))
end
redis.call('ZADD',KEYS[1],now,ARGV[3])
redis.call('PEXPIRE',KEYS[1],window)
return 0
"""

class RateLimitUnavailable(RuntimeError):
    pass

class RedisBillingLimiter:
    def __init__(self, client, namespace="wondertale:billing:test"):
        if not isinstance(namespace,str) or not namespace or len(namespace)>128:
            raise ValueError("Invalid namespace")
        self.client=client
        self.namespace=namespace

    def retry_after(self, scope: str, owner: str, *, limit: int, window_seconds: int=60) -> int:
        """Return zero if admitted, otherwise retry delay. Fail closed on Redis errors."""
        if not isinstance(scope,str) or not isinstance(owner,str) or not scope or not owner or len(scope)>128 or len(owner)>256:
            raise ValueError("Invalid limiter identity")
        if type(limit) is not int or not 1<=limit<=1000 or type(window_seconds) is not int or not 1<=window_seconds<=3600:
            raise ValueError("Invalid rate policy")
        digest=hashlib.sha256((str(len(scope))+":"+scope+owner).encode()).hexdigest()
        key=self.namespace+":"+digest
        try:
            result=self.client.eval(_SCRIPT,1,key,window_seconds*1000,limit,uuid4().hex)
            if type(result) is not int or not 0<=result<=window_seconds:
                raise RuntimeError("Invalid limiter response")
            return result
        except Exception:
            raise RateLimitUnavailable("Rate limiter unavailable") from None
