-- Atomic, idempotent application of Mercado Pago approved entitlements.
CREATE TABLE IF NOT EXISTS public.payment_entitlement_applications (
  provider text NOT NULL,
  provider_payment_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_payment_id)
);
ALTER TABLE public.payment_entitlement_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_entitlement_applications FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_payment_entitlement_once(
  target_user uuid, payment_status text, access_months integer, payment_reference text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted_count integer;
BEGIN
  IF payment_status <> 'approved' THEN
    -- Non-approved states must be handled by a separate verified reversal workflow.
    RETURN false;
  END IF;
  IF payment_reference IS NULL OR length(trim(payment_reference)) = 0 OR access_months NOT IN (1,12) THEN
    RAISE EXCEPTION 'Invalid payment reference or plan duration';
  END IF;
  PERFORM 1 FROM public.payment_transactions
    WHERE provider='mercado_pago' AND provider_payment_id=payment_reference
      AND user_id=target_user AND status='approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved transaction not found'; END IF;
  INSERT INTO public.payment_entitlement_applications(provider,provider_payment_id,user_id)
    VALUES ('mercado_pago',payment_reference,target_user)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count=0 THEN RETURN false; END IF;
  PERFORM public.apply_payment_entitlement(target_user,'approved',access_months,payment_reference);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apply_payment_entitlement_once(uuid,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_entitlement_once(uuid,text,integer,text) TO service_role;
