BEGIN;
CREATE TABLE billing_order_entitlements (
 order_id UUID PRIMARY KEY REFERENCES payment_orders(id),
 subscription_id UUID NOT NULL UNIQUE REFERENCES subscriptions(id),
 linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Backfill only explicit provider relationships, never infer from dates.
INSERT INTO billing_order_entitlements(order_id,subscription_id)
 SELECT order_id,subscription_id FROM payme_transactions WHERE subscription_id IS NOT NULL
 UNION ALL
 SELECT order_id,subscription_id FROM click_transactions WHERE subscription_id IS NOT NULL;
COMMIT;
