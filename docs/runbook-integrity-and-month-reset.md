# Runbook: Nightly integrity check and month reset

## Integrity check

Run nightly via Celery beat. Alert if any row is returned.

```sql
SELECT a.id, a.balance_cents,
       COALESCE(i.total,0) - COALESCE(o.total,0) AS ledger_balance
FROM accounts a
LEFT JOIN (
    SELECT to_account_id id, sum(amount_cents) total
    FROM ledger_entries GROUP BY 1
) i USING (id)
LEFT JOIN (
    SELECT from_account_id id, sum(amount_cents) total
    FROM ledger_entries GROUP BY 1
) o USING (id)
WHERE a.balance_cents <> COALESCE(i.total,0) - COALESCE(o.total,0);
```

If rows are returned: do NOT auto-correct. Page the on-call engineer.
Corrections are new ledger entries, never edits to existing rows.

## Month reset (1st of each month)

Resets `funded_cents` and `spent_cents` on all envelope accounts.
Never touches `balance_cents`.

```sql
UPDATE accounts
SET funded_cents = 0, spent_cents = 0, updated_at = now()
WHERE kind = 'envelope';
```

Also resets `done_this_month` on routine steps:

```sql
UPDATE routine_steps SET done_this_month = false;
```

## Subscription dunning

Run hourly via Celery beat:

1. Find subscriptions where `current_period_end < now()` and `status = 'active'` → set `status = 'grace'`.
2. Find subscriptions where `current_period_end + 7 days < now()` and `status = 'grace'` → set `status = 'expired'`, set `users.plan_tier = 'free'`.
3. Find subscriptions where `current_period_end - 3 days < now()` and `status = 'active'` → send renewal reminder push.

## Backup restore drill

Monthly: restore the latest encrypted backup to a staging database and run:

```bash
cd apps/api && alembic upgrade head && pytest tests/ -q
```

An untested backup is not a backup.
