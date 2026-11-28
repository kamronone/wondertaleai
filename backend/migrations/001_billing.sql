-- Manual migration only. Do not run against existing Neon without authorization.
BEGIN;
CREATE TABLE billing_plans (
 id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
 price_minor BIGINT NOT NULL CHECK(price_minor>=0),
 currency TEXT NOT NULL CHECK(currency='UZS'),
 story_limit INTEGER NOT NULL CHECK(story_limit>=0),
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(id,version)
);
INSERT INTO billing_plans(id,version,price_minor,currency,story_limit)
VALUES ('free',1,0,'UZS',0),('plus',1,3900000,'UZS',20),('family',1,7900000,'UZS',60);
CREATE TABLE subscriptions (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id),
 plan_id TEXT NOT NULL, plan_version INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','expired','canceled')),
 period_start TIMESTAMPTZ NOT NULL, period_end TIMESTAMPTZ NOT NULL,
 cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
 CHECK(period_end>period_start),
 FOREIGN KEY(plan_id,plan_version) REFERENCES billing_plans(id,version),
 UNIQUE(id,owner_id)
);
CREATE UNIQUE INDEX billing_one_active_subscription ON subscriptions(owner_id) WHERE status='active';
CREATE TABLE payment_orders (
 id UUID PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id),
 plan_id TEXT NOT NULL, plan_version INTEGER NOT NULL,
 amount_minor BIGINT NOT NULL CHECK(amount_minor>0),
 currency TEXT NOT NULL CHECK(currency='UZS'),
 provider TEXT NOT NULL CHECK(provider IN ('sandbox','payme','click')),
 state TEXT NOT NULL CHECK(state IN ('pending','paid','failed','expired','partially_refunded','refunded')),
 idempotency_key TEXT NOT NULL, provider_transaction_id TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(plan_id,plan_version) REFERENCES billing_plans(id,version),
 UNIQUE(owner_id,idempotency_key), UNIQUE(provider,provider_transaction_id)
);
CREATE INDEX billing_orders_owner_created ON payment_orders(owner_id,created_at DESC);
CREATE TABLE payment_events (
 provider TEXT NOT NULL, event_id TEXT NOT NULL,
 order_id UUID NOT NULL REFERENCES payment_orders(id),
 payload_digest TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 processed_at TIMESTAMPTZ, PRIMARY KEY(provider,event_id)
);
CREATE TABLE quota_reservations (
 owner_id TEXT NOT NULL, subscription_id UUID NOT NULL,
 period_start TIMESTAMPTZ NOT NULL, request_id UUID NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('reserved','committed','released')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,request_id),
 FOREIGN KEY(subscription_id,owner_id) REFERENCES subscriptions(id,owner_id)
);
CREATE INDEX billing_quota_period ON quota_reservations(subscription_id,period_start,state);
CREATE TABLE refunds (
 id UUID PRIMARY KEY, order_id UUID NOT NULL REFERENCES payment_orders(id),
 amount_minor BIGINT NOT NULL CHECK(amount_minor>0),
 provider_ref TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','completed','failed')),
 UNIQUE(order_id,provider_ref)
);
COMMIT;
