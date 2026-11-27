BEGIN;
ALTER TABLE billing_promotion_redemptions DROP CONSTRAINT billing_promotion_redemptions_code_owner_id_key;
CREATE UNIQUE INDEX billing_promotion_one_live_claim
 ON billing_promotion_redemptions(code,owner_id) WHERE state IN ('reserved','used');
COMMIT;
