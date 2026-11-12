-- Apply after supabase-setup.sql when upgrading a database created from its
-- earlier version. This migration does not copy or rewrite existing orders.

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;

CREATE TABLE IF NOT EXISTS public.manual_order_audit (
    order_id TEXT PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.manual_order_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manual_order_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.manual_order_audit TO service_role;

CREATE OR REPLACE FUNCTION public.create_manual_order_with_audit(
    p_order JSONB,
    p_admin_user_id UUID,
    p_audit_metadata JSONB
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_admin_user_id) THEN
    RAISE EXCEPTION 'Administrator membership is required.';
  END IF;
  IF jsonb_typeof(p_order) IS DISTINCT FROM 'object'
     OR p_order->>'order_source' IS DISTINCT FROM 'manual'
     OR p_order->>'is_manual' IS DISTINCT FROM 'true'
     OR coalesce(p_order->>'tracking_token_hash', '') !~ '^[a-f0-9]{64}$'
     OR jsonb_typeof(p_audit_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid manual order request.';
  END IF;

  INSERT INTO public.orders (
    id, order_number, idempotency_key, customer, items, subtotal, delivery_fee,
    discount, total_amount, payment_method, payment_status, order_status,
    status_history, estimated_delivery_time, order_source, is_manual,
    tracking_token_hash, created_at, updated_at
  ) VALUES (
    p_order->>'id',
    p_order->>'order_number',
    p_order->>'idempotency_key',
    p_order->'customer',
    p_order->'items',
    (p_order->>'subtotal')::NUMERIC,
    (p_order->>'delivery_fee')::NUMERIC,
    (p_order->>'discount')::NUMERIC,
    (p_order->>'total_amount')::NUMERIC,
    p_order->>'payment_method',
    p_order->>'payment_status',
    p_order->>'order_status',
    p_order->'status_history',
    p_order->>'estimated_delivery_time',
    'manual',
    TRUE,
    p_order->>'tracking_token_hash',
    (p_order->>'created_at')::TIMESTAMPTZ,
    (p_order->>'updated_at')::TIMESTAMPTZ
  )
  RETURNING * INTO v_order;

  INSERT INTO public.manual_order_audit (order_id, admin_user_id, metadata)
  VALUES (v_order.id, p_admin_user_id, p_audit_metadata);
  RETURN NEXT v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_order_with_audit(JSONB, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_order_with_audit(JSONB, UUID, JSONB) TO service_role;

DROP POLICY IF EXISTS "Public guest can create order" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
REVOKE INSERT ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.orders TO authenticated;

CREATE OR REPLACE FUNCTION public.get_order_by_reference(p_reference TEXT)
RETURNS TABLE (
    id TEXT,
    order_number TEXT,
    idempotency_key TEXT,
    customer JSONB,
    items JSONB,
    subtotal NUMERIC(10, 2),
    delivery_fee NUMERIC(10, 2),
    discount NUMERIC(10, 2),
    total_amount NUMERIC(10, 2),
    payment_method TEXT,
    payment_status TEXT,
    order_status TEXT,
    status_history JSONB,
    estimated_delivery_time TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_ref TEXT := trim(coalesce(p_reference, ''));
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_ref = '' OR NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE public.orders.order_number = v_ref OR public.orders.id = v_ref
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_order.id, v_order.order_number, v_order.idempotency_key, v_order.customer,
    v_order.items, v_order.subtotal, v_order.delivery_fee, v_order.discount,
    v_order.total_amount, v_order.payment_method, v_order.payment_status,
    v_order.order_status, v_order.status_history, v_order.estimated_delivery_time,
    v_order.created_at, v_order.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_reference(TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
