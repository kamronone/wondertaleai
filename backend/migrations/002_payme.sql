BEGIN;
CREATE TABLE payme_transactions (
 provider_id TEXT PRIMARY KEY CHECK (length(provider_id)=24),
 order_id UUID NOT NULL UNIQUE REFERENCES payment_orders(id),
 amount_minor BIGINT NOT NULL CHECK (amount_minor>0),
 provider_time BIGINT NOT NULL CHECK (provider_time>0),
 create_time BIGINT NOT NULL CHECK (create_time>0),
 perform_time BIGINT NOT NULL DEFAULT 0,
 cancel_time BIGINT NOT NULL DEFAULT 0,
 state INTEGER NOT NULL DEFAULT 1 CHECK (state IN (1,2,-1,-2)),
 reason INTEGER,
 subscription_id UUID UNIQUE REFERENCES subscriptions(id)
);
CREATE INDEX payme_transactions_provider_time_idx ON payme_transactions(provider_time);
COMMIT;
