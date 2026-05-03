-- Step 5: Nightly overdue sweeps via pg_cron
--
-- Prerequisites:
--   1. Enable pg_cron in Supabase Dashboard → Database → Extensions → pg_cron
--   2. Run this migration AFTER enabling the extension
--
-- After running this migration:
--   3. In Supabase Dashboard → Database → Webhooks, create a webhook on the
--      accounts_receivable table for UPDATE events where NEW.status = 'overdue',
--      targeting the send-payment-reminder Edge Function URL.

-- Remove pre-existing jobs (idempotent re-runs)
-- cron.unschedule by jobid avoids errors when job does not exist
SELECT cron.unschedule(jobid) FROM cron.job
  WHERE jobname IN ('mark-overdue-ar', 'mark-overdue-ap', 'mark-overdue-schedule');

-- Accounts receivable — mark pending/partial as overdue after due_date passes
SELECT cron.schedule(
  'mark-overdue-ar',
  '0 1 * * *',
  $$
    UPDATE accounts_receivable
    SET    status     = 'overdue',
           updated_at = now()
    WHERE  status IN ('pending', 'partial')
      AND  due_date < CURRENT_DATE;
  $$
);

-- Accounts payable — same logic for payables
SELECT cron.schedule(
  'mark-overdue-ap',
  '0 1 * * *',
  $$
    UPDATE accounts_payable
    SET    status     = 'overdue',
           updated_at = now()
    WHERE  status IN ('pending', 'partial')
      AND  due_date < CURRENT_DATE;
  $$
);

-- Payment schedule installments — mark pending installments overdue
SELECT cron.schedule(
  'mark-overdue-schedule',
  '0 1 * * *',
  $$
    UPDATE payment_schedule
    SET    status     = 'overdue',
           updated_at = now()
    WHERE  status    = 'pending'
      AND  due_date < CURRENT_DATE;
  $$
);

-- Verify scheduled jobs
-- SELECT jobid, jobname, schedule, command FROM cron.job;
