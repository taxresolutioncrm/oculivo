-- Oculivo: signed clinical record integrity
-- Safe alongside existing RLS policies: a trigger prevents updates/deletes to already signed rows.
-- Requires verification that public.clinical_records.signed_at exists in the target database.
-- This deliberately does not change org policies, grants, or any unsigned draft workflow.

DO $block$
BEGIN
  IF to_regclass('public.clinical_records') IS NULL THEN
    RAISE EXCEPTION 'Required table public.clinical_records does not exist; no changes applied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinical_records'
      AND column_name='signed_at' AND data_type='timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'Required clinical_records.signed_at timestamptz column missing; no changes applied';
  END IF;
END
$block$;

CREATE OR REPLACE FUNCTION public.oculivo_prevent_signed_clinical_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Signed clinical records are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.signed_at IS DISTINCT FROM OLD.signed_at
     AND NEW.signed_at IS NULL THEN
    RAISE EXCEPTION 'Cannot remove a clinical signature' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS oculivo_signed_clinical_immutable ON public.clinical_records;
CREATE TRIGGER oculivo_signed_clinical_immutable
BEFORE UPDATE OR DELETE ON public.clinical_records
FOR EACH ROW EXECUTE FUNCTION public.oculivo_prevent_signed_clinical_mutation();

-- Audit after applying:
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='public.clinical_records'::regclass
--   AND tgname='oculivo_signed_clinical_immutable';
