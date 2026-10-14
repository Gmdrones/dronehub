-- Idempotent, auditable payment application; deployed to Supabase 2026-10-14.
CREATE TABLE IF NOT EXISTS public.entitlement_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 event_type text NOT NULL,
 provider text,
 payment_reference text,
 old_expiry timestamptz,
 new_expiry timestamptz,
 access_months integer,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entitlement_events_user_time_idx ON public.entitlement_events(user_id,created_at DESC);
ALTER TABLE public.entitlement_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entitlement_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.entitlement_events TO service_role;
CREATE TABLE IF NOT EXISTS public.payment_entitlement_applications (
 provider text NOT NULL,
 provider_payment_id text NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 applied_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,provider_payment_id)
);
ALTER TABLE public.payment_entitlement_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_entitlement_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.payment_entitlement_applications TO service_role;
INSERT INTO public.payment_entitlement_applications(provider,provider_payment_id,user_id)
SELECT provider,provider_payment_id,user_id FROM public.payment_transactions WHERE status='approved'
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.apply_payment_entitlement_once(target_user uuid,payment_status text,access_months integer,payment_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted_count integer; previous_expiry timestamptz; next_expiry timestamptz;
BEGIN
 IF payment_status <> 'approved' THEN
  PERFORM public.apply_payment_entitlement(target_user,payment_status,access_months,payment_reference);
  RETURN false;
 END IF;
 IF payment_reference IS NULL OR btrim(payment_reference)='' OR access_months NOT IN (1,12) THEN
  RAISE EXCEPTION 'Invalid payment reference or duration';
 END IF;
 PERFORM 1 FROM public.payment_transactions WHERE provider='mercado_pago' AND provider_payment_id=payment_reference
  AND user_id=target_user AND status='approved';
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved payment not found for user'; END IF;
 INSERT INTO public.payment_entitlement_applications(provider,provider_payment_id,user_id)
 VALUES('mercado_pago',payment_reference,target_user) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 IF inserted_count=0 THEN RETURN false; END IF;
 SELECT courtesy_expires_at INTO previous_expiry FROM public.account_entitlements WHERE user_id=target_user FOR UPDATE;
 next_expiry:=greatest(now(),coalesce(previous_expiry,now()))+make_interval(months=>access_months);
 INSERT INTO public.account_entitlements(user_id,plan,role,status,courtesy_expires_at,source,updated_at)
 VALUES(target_user,'pro','member','active',next_expiry,'mercado_pago:'||payment_reference,now())
 ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active',
 role=CASE WHEN account_entitlements.role='admin' THEN 'admin' ELSE 'member' END,
 courtesy_expires_at=next_expiry,source='mercado_pago:'||payment_reference,updated_at=now();
 INSERT INTO public.entitlement_events(user_id,event_type,provider,payment_reference,old_expiry,new_expiry,access_months)
 VALUES(target_user,'payment_applied','mercado_pago',payment_reference,previous_expiry,next_expiry,access_months);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apply_payment_entitlement_once(uuid,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_entitlement_once(uuid,text,integer,text) TO service_role;
