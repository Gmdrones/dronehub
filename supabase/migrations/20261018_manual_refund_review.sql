-- Manual review: a refund/chargeback must never automatically revoke PRO.
CREATE TABLE IF NOT EXISTS public.payment_review_queue (
 provider text NOT NULL,
 provider_payment_id text NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 reason text NOT NULL CHECK(reason IN ('refunded','charged_back')),
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 resolution_notes text,
 PRIMARY KEY(provider,provider_payment_id)
);
CREATE INDEX IF NOT EXISTS payment_review_queue_pending_idx ON public.payment_review_queue(review_status,created_at);
ALTER TABLE public.payment_review_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_review_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.payment_review_queue TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_payment_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IN ('refunded','charged_back') THEN
  INSERT INTO public.payment_review_queue(provider,provider_payment_id,user_id,reason,review_status,updated_at)
  VALUES(NEW.provider,NEW.provider_payment_id,NEW.user_id,NEW.status,'pending',now())
  ON CONFLICT(provider,provider_payment_id) DO UPDATE
   SET reason=EXCLUDED.reason, updated_at=now(),
       review_status=CASE WHEN payment_review_queue.reason IS DISTINCT FROM EXCLUDED.reason THEN 'pending' ELSE payment_review_queue.review_status END;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payment_review_queue ON public.payment_transactions;
CREATE TRIGGER trg_payment_review_queue AFTER INSERT OR UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_payment_review();
INSERT INTO public.payment_review_queue(provider,provider_payment_id,user_id,reason)
SELECT provider,provider_payment_id,user_id,status FROM public.payment_transactions
WHERE status IN ('refunded','charged_back')
ON CONFLICT DO NOTHING;
REVOKE ALL ON FUNCTION public.enqueue_payment_review() FROM PUBLIC,anon,authenticated;
