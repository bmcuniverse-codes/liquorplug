-- Server-only application tables. The connection role must own these tables.
-- Owners retain access; browser/API roles must use the Express endpoints.
-- Compatible with PostgreSQL, including a dedicated Supabase project.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['migrations','users','sessions','password_resets','rate_buckets','products','taxonomy','content','content_versions','zones','coupons','orders','order_items','order_events','payments','refunds','stock_movements','audit_log','notifications','email_outbox']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',t);
    END IF;
  END LOOP;
END $$;
