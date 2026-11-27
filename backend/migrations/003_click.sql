BEGIN;
CREATE TABLE click_transactions (
 prepare_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 click_trans_id TEXT NOT NULL UNIQUE,
 order_id UUID NOT NULL UNIQUE REFERENCES payment_orders(id),
 amount_minor BIGINT NOT NULL CHECK (amount_minor>0),
 state TEXT NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','completed','canceled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ,
 subscription_id UUID UNIQUE REFERENCES subscriptions(id)
);
COMMIT;
