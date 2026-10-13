CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.account_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  courtesy_expires_at timestamptz,
  source text NOT NULL DEFAULT 'signup',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO auth.users (id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');

\i supabase/migrations/20261012215000_payment_entitlement_idempotence.sql

SELECT public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','approved',1,'A');
CREATE TEMP TABLE first_expiry AS SELECT courtesy_expires_at AS expiry
  FROM public.account_entitlements WHERE user_id='11111111-1111-4111-8111-111111111111';

SELECT public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','approved',1,'A');
DO $$ BEGIN
 IF (SELECT courtesy_expires_at FROM public.account_entitlements WHERE user_id='11111111-1111-4111-8111-111111111111')
    <> (SELECT expiry FROM first_expiry) THEN
   RAISE EXCEPTION 'Duplicate payment extended PRO'; END IF;
END $$;

SELECT public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','approved',1,'B');
DO $$ BEGIN
 IF (SELECT courtesy_expires_at FROM public.account_entitlements WHERE user_id='11111111-1111-4111-8111-111111111111')
    <= (SELECT expiry FROM first_expiry) THEN
   RAISE EXCEPTION 'New payment failed to extend PRO'; END IF;
END $$;

SELECT public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','refunded',1,'A');
DO $$ BEGIN
 IF (SELECT plan FROM public.account_entitlements WHERE user_id='11111111-1111-4111-8111-111111111111')
    <> 'pro' THEN RAISE EXCEPTION 'Old refund cancelled newer plan'; END IF;
END $$;

SELECT public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','charged_back',1,'B');
DO $$ BEGIN
 IF (SELECT status FROM public.account_entitlements WHERE user_id='11111111-1111-4111-8111-111111111111')
    <> 'cancelled' THEN RAISE EXCEPTION 'Chargeback not applied'; END IF;
END $$;

SELECT public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','refunded',1,'C');
SELECT public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','approved',1,'C');
DO $$ BEGIN
 IF (SELECT status FROM public.account_entitlements WHERE user_id='11111111-1111-4111-8111-111111111111')
    <> 'cancelled' THEN RAISE EXCEPTION 'Previously refunded purchase reactivated PRO'; END IF;
END $$;

DO $$ BEGIN
 BEGIN
   PERFORM public.apply_payment_entitlement('22222222-2222-4222-8222-222222222222','approved',1,'A');
   RAISE EXCEPTION 'Cross-user payment was accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM <> 'Payment reference belongs to another user' THEN RAISE; END IF;
 END;
END $$;

DO $$ BEGIN
 BEGIN
   PERFORM public.apply_payment_entitlement('11111111-1111-4111-8111-111111111111','approved',13,'D');
   RAISE EXCEPTION 'Invalid subscription duration accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM <> 'Invalid subscription duration' THEN RAISE; END IF;
 END;
END $$;

SELECT 'PASS: payment entitlement migration rehearsal' AS result;
