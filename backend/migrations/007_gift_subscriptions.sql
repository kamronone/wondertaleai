BEGIN;
CREATE TABLE billing_gift_codes (
 id UUID PRIMARY KEY,
 purchaser_id TEXT NOT NULL REFERENCES parents(id),
 plan_id TEXT NOT NULL CHECK (plan_id IN ('plus','family')),
 plan_version INTEGER NOT NULL,
 code_digest TEXT NOT NULL UNIQUE CHECK (length(code_digest)=64),
 state TEXT NOT NULL CHECK (state IN ('pending','available','redeemed','revoked','expired')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 redeemed_by TEXT REFERENCES parents(id),
 redeemed_at TIMESTAMPTZ,
 subscription_id UUID UNIQUE REFERENCES subscriptions(id),
 FOREIGN KEY (plan_id,plan_version) REFERENCES billing_plans(id,version),
 CHECK (expires_at>created_at),
 CHECK ((state='redeemed' AND redeemed_by IS NOT NULL AND redeemed_at IS NOT NULL AND subscription_id IS NOT NULL)
 OR (state<>'redeemed' AND redeemed_by IS NULL AND redeemed_at IS NULL AND subscription_id IS NULL))
);
CREATE INDEX billing_gift_purchaser ON billing_gift_codes(purchaser_id,created_at DESC);
COMMIT;
