BEGIN;
CREATE TABLE billing_gift_orders (
 order_id UUID PRIMARY KEY REFERENCES payment_orders(id),
 gift_id UUID NOT NULL UNIQUE REFERENCES billing_gift_codes(id)
);
COMMIT;
