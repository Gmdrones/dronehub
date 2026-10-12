-- Safe and idempotent Mercado Pago entitlement applications.
-- This migration is prepared for review; do not deploy without a backup and staging test.
CREATE TABLE IF NOT EXISTS public.payment_entitlement_events (
  payment_reference text NOT NULL,
  payment_status text NOT NULL,
  user_id uuid NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_reference, payment_status)
);
ALTER TABLE public.payment_entitlement_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_entitlement_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_payment_entitlement(
  target_user uuid,
  payment_status text,
  access_months integer,
  payment_reference text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected_rows integer;
  next_expiry timestamptz;
BEGIN
  IF target_user IS NULL OR payment_reference IS NULL OR length(trim(payment_reference)) < 1 THEN
    RAISE EXCEPTION 'Missing payment identity';
  END IF;
  IF payment_status NOT IN ('approved','refunded','charged_back','cancelled','pending') THEN
    RAISE EXCEPTION 'Invalid payment state';
  END IF;
  IF payment_status = 'approved' AND (access_months NOT IN (1,12)) THEN
    RAISE EXCEPTION 'Invalid subscription duration';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_entitlement_events e\n             WHERE e.payment_reference = $4 AND e.user_id <> target_user) THEN\n    RAISE EXCEPTION 'Payment reference belongs to another user';\n  END IF;\n  IF payment_status = 'pending' THEN
    RETURN;
  END IF;

  -- Serialize all entitlement updates for one user, including different payments.\n  PERFORM pg_advisory_xact_lock(hashtextextended(target_user::text, 0));\n\n  INSERT INTO public.payment_entitlement_events(payment_reference,payment_status,user_id)
  VALUES(payment_reference,payment_status,target_user)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN RETURN; END IF;

  IF payment_status = 'approved' THEN
    -- Do not reactivate a payment already reversed.
    IF EXISTS (
      SELECT 1 FROM public.payment_entitlement_events e
      WHERE e.payment_reference = $4
        AND e.payment_status IN ('refunded','charged_back','cancelled')
    ) THEN RETURN; END IF;
    SELECT greatest(now(),coalesce(courtesy_expires_at,now()))
           + make_interval(months => access_months)
    INTO next_expiry
    FROM public.account_entitlements WHERE user_id=target_user FOR UPDATE;
    next_expiry := coalesce(next_expiry,now()+make_interval(months => access_months));
    INSERT INTO public.account_entitlements
      (user_id,plan,role,status,courtesy_expires_at,source,updated_at)
    VALUES
      (target_user,'pro','member','active',next_expiry,
       'mercado_pago:'||payment_reference,now())
    ON CONFLICT (user_id) DO UPDATE SET
      plan='pro',
      role=CASE WHEN account_entitlements.role='admin' THEN 'admin' ELSE 'member' END,
      status='active',
      courtesy_expires_at=next_expiry,
      source='mercado_pago:'||payment_reference,
      updated_at=now();
  ELSE
    -- A refund must not undo a newer, unrelated subscription.\n    -- Verify the event belongs to the same user before any update.
    UPDATE public.account_entitlements
    SET plan=CASE WHEN role='admin' THEN plan ELSE 'free' END,
        status=CASE WHEN role='admin' THEN status ELSE 'cancelled' END,
        courtesy_expires_at=CASE WHEN role='admin' THEN courtesy_expires_at ELSE now() END,
        source='mercado_pago:'||payment_reference,updated_at=now()
    WHERE user_id=target_user AND source='mercado_pago:'||payment_reference;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_payment_entitlement(uuid,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_entitlement(uuid,text,integer,text) TO service_role;
