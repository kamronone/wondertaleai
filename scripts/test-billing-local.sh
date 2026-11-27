#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project="wondertale-billing-test"
compose=(docker compose -p "$project" -f compose.billing-test.yaml)
cleanup() { "${compose[@]}" down --volumes; }
trap cleanup EXIT
"${compose[@]}" up -d --wait
export BILLING_LOCAL_TEST_DSN="postgresql://billing_test:local_billing_test_only@127.0.0.1:55432/wondertale_billing_test"
export PYTHONPATH="$PWD/backend"
python -m pytest backend/tests/test_billing_domain.py backend/tests/test_billing_click.py backend/tests/test_billing_postgres.py backend/tests/test_billing_concurrency.py backend/tests/test_billing_admin_auth.py backend/tests/test_billing_gift_api.py -q -rs
