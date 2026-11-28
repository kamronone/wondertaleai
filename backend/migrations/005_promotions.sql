BEGIN;
CREATE TABLE billing_promotions (
 code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{4,32}$'),
 discount_kind TEXT NOT NULL CHECK (discount_kind IN ('percent','fixed')),
 discount_value BIGINT NOT NULL CHECK (discount_value>0),
 CHECK (discount_kind <> 'percent' OR discount_value BETWEEN 1 AND 99),
 plan_id TEXT CHECK (plan_id IN ('plus','family')),
 starts_at TIMESTAMPTZ NOT NULL,
 ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at>starts_at),
 max_uses INTEGER NOT NULL CHECK (max_uses>0),
 enabled BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE billing_promotion_redemptions (
 order_id UUID PRIMARY KEY REFERENCES payment_orders(id),
 code TEXT NOT NULL REFERENCES billing_promotions(code),
 owner_id TEXT NOT NULL REFERENCES parents(id),
 discount_minor BIGINT NOT NULL CHECK (discount_minor>0),
 state TEXT NOT NULL CHECK (state IN ('reserved','used','released')),
 UNIQUE(code,owner_id)
);
CREATE INDEX billing_promotion_usage ON billing_promotion_redemptions(code,state);
COMMIT;
