# WonderTale Billing v1 — implementation specification (not active)

## Plans
Currency UZS, integer minor units (tiyin). Free: 0, no paid AI quota; Plus: 3,900,000 tiyin / 20 text stories; Family: 7,900,000 tiyin / 60 text stories. One calendar-month subscription period from activation, UTC, clamp end-of-month dates. No automatic renewal until explicitly consented and provider supports it. Images and video excluded. Pilot quota remains independent until migration is authorized.

## PostgreSQL model
- billing_plans: id, version, price_minor, currency, story_limit, enabled; unique(id,version).
- subscriptions: id, owner_id FK parents, plan/version FK, status, period_start, period_end, cancel_at_period_end; partial unique index on owner for active subscriptions.
- payment_orders: id, owner_id, plan/version, amount_minor, currency, provider, state, idempotency_key, created_at; unique(owner_id,idempotency_key).
- payment_events: provider, event_id, order_id, payload_digest, received_at, processed_at; unique(provider,event_id).
- quota_reservations: owner_id, subscription_id, period_start, request_id, state, created_at; unique(owner_id,request_id).
- refunds: id, order_id, amount_minor, provider_ref, state; unique(provider_ref).
All timestamps timezone-aware; amount and quota nonnegative; foreign keys and transaction locking mandatory. No card numbers, CVV or child data in billing records.

## API contract (future)
GET /api/billing/plans — published versioned plans.
GET /api/billing/status — authenticated owner, subscription state, period and remaining quota, explicit payments_enabled.
POST /api/billing/orders — authenticated parent, plan ID, idempotency key; server resolves price, returns provider-hosted checkout only if enabled.
GET /api/billing/orders — owner-scoped paginated history.
POST /api/billing/subscription/cancel — owner-scoped cancellation at period end.
Provider-specific authenticated callbacks — verify signatures/authentication, merchant, amount, currency, order and provider transaction identity; persist event and transition atomically. Never activate from browser redirect.
Refunds restricted to authorized operators and reconciled against provider settlement.

## State and quota
Order: pending -> paid | failed | expired; paid -> partially_refunded | refunded. Reject invalid or duplicate transitions without granting duplicate entitlement. Activation and event recording in one transaction. A renewal starts at max(now, existing period end); upgrades require explicit proration policy before enabling. Expired subscriptions deny new paid generations. Reserve quota atomically with AI job creation, commit on success, release only on confirmed eligible failure; keep separate provider spend counters and global budget even on failures. Reconcile abandoned reservations. Never trust frontend limits.

## Release gates
Feature flag BILLING_ENABLED defaults false. No real payment credentials or migrations until separately authorized. Choose Payme or Click after merchant onboarding and review of current official provider protocol; use sandbox first. Verify duplicate callbacks, amount mismatch, forged callbacks, concurrent quota requests, cross-account access, expiry, cancellation, refunds, crash recovery, reconciliation and privacy. Publish approved legal operator, terms and refund policy before collecting money. No live charges in this phase.

## Scope
Documentation only. Existing backend, database, main and production unchanged. This specification is not a deployed billing system.
