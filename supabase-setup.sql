-- =========================================================================
-- CHANDU CHICKEN CENTER - SECURE PRODUCTION SUPABASE DATABASE SETUP
-- =========================================================================
-- Architecture:
--   1. Role-Based Access Control (RBAC) via trusted `public.admin_users` table
--   2. Hardened `is_admin()` function without client-editable `user_metadata`
--   3. Privacy-protected order tracking with masked customer PII
--   4. Guest checkout preserved without mandatory customer login
--   5. Full admin product management (INSERT, UPDATE, DELETE) with RLS
--   6. Safe idempotent seeds for all 6 categories, 9 products, and settings
--
-- HOW TO RUN:
--   Copy this entire script and execute it in Supabase Dashboard -> SQL Editor.
--   Do NOT execute automated scripts; review and run manually.
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. CORE APPLICATION TABLES
-- =========================================================================

-- CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    cut_options JSONB NOT NULL DEFAULT '["Curry Cut", "Biryani Cut", "Small Pieces"]'::jsonb,
    weights JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    badge TEXT,
    net_weight_description TEXT DEFAULT 'Cleaned net meat weight',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weights JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON public.products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);

-- PRODUCT WEIGHTS TABLE (Normalized variant pricing)
CREATE TABLE IF NOT EXISTS public.product_weights (
    id BIGSERIAL PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    weight TEXT NOT NULL CHECK (weight IN ('250g', '500g', '1kg')),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, weight)
);

CREATE INDEX IF NOT EXISTS idx_product_weights_pid ON public.product_weights(product_id);

-- SHOP SETTINGS TABLE (Singleton row with id = 1)
CREATE TABLE IF NOT EXISTS public.shop_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    shop_name TEXT NOT NULL DEFAULT 'Chandu Chicken Center',
    tagline TEXT NOT NULL DEFAULT '100% Farm Fresh Tender Chicken Delivered in 45 Mins',
    shop_phone TEXT NOT NULL DEFAULT '+91 98480 22338',
    shop_whatsapp TEXT NOT NULL DEFAULT '+91 98480 22338',
    address TEXT NOT NULL DEFAULT 'Shop No. 4, Main Road, Market Junction, Near RTC Bus Stand',
    landmark TEXT DEFAULT 'Opposite Rythu Bazar',
    city TEXT NOT NULL DEFAULT 'Hyderabad / Vijayawada',
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    open_time TEXT NOT NULL DEFAULT '07:00 AM',
    close_time TEXT NOT NULL DEFAULT '09:00 PM',
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    free_delivery_threshold NUMERIC(10, 2) NOT NULL DEFAULT 499.00,
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_time_estimate_mins INTEGER NOT NULL DEFAULT 45,
    announcement_banner TEXT DEFAULT '⚡ Fast delivery in 45 minutes! 100% RO Water Cleaned, Antibiotic-Free Chicken.',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_shop_settings_row CHECK (id = 1)
);

-- ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    idempotency_key TEXT UNIQUE,
    customer JSONB NOT NULL,
    items JSONB NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'UPI', 'Cash')),
    payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
    order_status TEXT NOT NULL DEFAULT 'New' CHECK (order_status IN ('New', 'Accepted', 'Preparing', 'Ready for Dispatch', 'Out for Delivery', 'Delivered', 'Rejected', 'Cancelled')),
    status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_delivery_time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'website';

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_token_hash
    ON public.orders(tracking_token_hash)
    WHERE tracking_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders USING btree ((customer->>'phone'));

-- =========================================================================
-- 3. TRUSTED ADMIN AUTHORIZATION SYSTEM
-- =========================================================================

-- Dedicated table storing authorized shop administrators
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manual_order_audit (
    order_id TEXT PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
    metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_tracking_legacy_limits (
    order_id TEXT PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_tracking_legacy_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_tracking_legacy_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_tracking_legacy_limits TO service_role;

CREATE OR REPLACE FUNCTION public.allow_legacy_order_tracking_attempt(
    p_order_id TEXT,
    p_customer_phone TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt_count INTEGER;
  v_window_started_at TIMESTAMPTZ;
  v_stored_phone TEXT;
  v_submitted_phone TEXT;
BEGIN
  INSERT INTO public.order_tracking_legacy_limits (order_id, attempt_count, window_started_at)
  VALUES (p_order_id, 0, NOW())
  ON CONFLICT (order_id) DO NOTHING;

  SELECT attempt_count, window_started_at
  INTO v_attempt_count, v_window_started_at
  FROM public.order_tracking_legacy_limits
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_window_started_at <= NOW() - INTERVAL '15 minutes' THEN
    v_attempt_count := 0;
    UPDATE public.order_tracking_legacy_limits
    SET attempt_count = 0, window_started_at = NOW()
    WHERE order_id = p_order_id;
  END IF;

  IF v_attempt_count >= 8 THEN
    RETURN FALSE;
  END IF;

  SELECT regexp_replace(coalesce(customer->>'phone', ''), '[^0-9]', '', 'g')
  INTO v_stored_phone
  FROM public.orders
  WHERE id = p_order_id;
  v_submitted_phone := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');

  IF length(v_submitted_phone) < 7
     OR length(v_submitted_phone) > 15
     OR v_stored_phone IS NULL
     OR v_stored_phone <> v_submitted_phone THEN
    UPDATE public.order_tracking_legacy_limits
    SET attempt_count = attempt_count + 1
    WHERE order_id = p_order_id;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.allow_legacy_order_tracking_attempt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allow_legacy_order_tracking_attempt(TEXT, TEXT) TO service_role;

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
    status_history, estimated_delivery_time, order_source, is_manual, tracking_token_hash,
    created_at, updated_at
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

-- Secure function to verify if the requesting user is an authorized admin
-- CRITICAL SECURITY:
--   1. Checks trusted `public.admin_users` table
--   2. Checks server-controlled `app_metadata` (only settable via service role/dashboard)
--   3. NEVER trusts `user_metadata` (preventing client-side token spoofing)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- 1. Check if authenticated user's UUID exists in trusted public.admin_users
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Server-controlled role claim in app_metadata (cannot be altered by client SDK)
  IF coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- User metadata is intentionally EXCLUDED to prevent privilege escalation
  RETURN FALSE;
END;
$$;

-- Secure helper function to safely authorize an administrator account by email.
-- Can only be executed from the SQL Editor or by service_role.
CREATE OR REPLACE FUNCTION public.authorize_admin_by_email(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_clean_email TEXT;
BEGIN
  v_clean_email := lower(trim(target_email));
  IF v_clean_email IS NULL OR v_clean_email = '' THEN
    RETURN 'ERROR: Please provide a valid email address.';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN 'ERROR: No Supabase Auth user found with email "' || target_email || '". Please create the user under Supabase -> Authentication -> Users first.';
  END IF;

  INSERT INTO public.admin_users (id, email, role)
  VALUES (v_user_id, v_clean_email, 'super_admin')
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin', email = v_clean_email;

  RETURN 'SUCCESS: User ' || target_email || ' (UUID: ' || v_user_id || ') is now authorized as super_admin.';
END;
$$;

-- Only database owner / service role may call the promotion helper
REVOKE ALL ON FUNCTION public.authorize_admin_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authorize_admin_by_email(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_admin_by_email(TEXT) TO service_role;

-- Clean up any insecure legacy functions
DROP FUNCTION IF EXISTS public.get_customer_orders_by_phone(TEXT);
DROP FUNCTION IF EXISTS public.get_order_by_reference(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_order_by_reference(TEXT);

-- Secure reference lookup for authorized administrators only.
-- Public tracking uses the high-entropy token Edge Function instead.
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
  v_ref TEXT;
  v_order public.orders%ROWTYPE;
BEGIN
  v_ref := trim(coalesce(p_reference, ''));
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

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.order_number,
    v_order.idempotency_key,
    v_order.customer,
    v_order.items,
    v_order.subtotal,
    v_order.delivery_fee,
    v_order.discount,
    v_order.total_amount,
    v_order.payment_method,
    v_order.payment_status,
    v_order.order_status,
    v_order.status_history,
    v_order.estimated_delivery_time,
    v_order.created_at,
    v_order.updated_at;
END;
$$;

-- =========================================================================
-- Only super administrators may grant, revoke, or change administrator roles.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $
  SELECT (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  ) OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super_admin';
$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 1. Categories Policies
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
    ON public.categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
CREATE POLICY "Admins can insert categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Admins can delete categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 2. Products Policies
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products"
    ON public.products FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
    ON public.products FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 3. Product Weights Policies
DROP POLICY IF EXISTS "Public can view product weights" ON public.product_weights;
CREATE POLICY "Public can view product weights"
    ON public.product_weights FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage product weights" ON public.product_weights;
CREATE POLICY "Admins can manage product weights"
    ON public.product_weights FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. Shop Settings Policies
DROP POLICY IF EXISTS "Public can view shop settings" ON public.shop_settings;
CREATE POLICY "Public can view shop settings"
    ON public.shop_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can update shop settings" ON public.shop_settings;
CREATE POLICY "Admins can update shop settings"
    ON public.shop_settings FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert shop settings" ON public.shop_settings;
CREATE POLICY "Admins can insert shop settings"
    ON public.shop_settings FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- 5. Orders Policies (Strict Customer Privacy Protection)
-- Orders are written by trusted server-side Edge Functions, not direct clients.
DROP POLICY IF EXISTS "Public guest can create order" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;

-- Direct SELECT on orders table is strictly restricted to verified shop administrators
-- (Casual visitors MUST use the token-protected tracking Edge Function)
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
CREATE POLICY "Admins can view orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
    ON public.orders FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 6. Admin Users Table Policies
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view own admin record" ON public.admin_users;
CREATE POLICY "Admins can view own admin record"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON public.admin_users;
CREATE POLICY "Super admins can manage admin_users"
    ON public.admin_users FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- =========================================================================
-- 5. LEAST-PRIVILEGE ROLE PERMISSIONS (GRANTs)
-- =========================================================================

-- Grant Schema Usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Categories (Public read, authenticated admin write)
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;

-- Products (Public read, authenticated admin write)
GRANT SELECT ON TABLE public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;

-- Product Weights (Public read, authenticated admin write)
GRANT SELECT ON TABLE public.product_weights TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_weights TO authenticated;
GRANT ALL ON TABLE public.product_weights TO service_role;

-- Shop Settings (Public read, authenticated admin write)
GRANT SELECT ON TABLE public.shop_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.shop_settings TO authenticated;
GRANT ALL ON TABLE public.shop_settings TO service_role;

-- Orders (authenticated admin read/update/delete; creation is server-side only)
REVOKE INSERT ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;

-- Admin Users (Authenticated check only)
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Execution permissions on secure functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_by_reference(TEXT) TO anon, authenticated, service_role;

-- =========================================================================
-- 6. SAFE SEED DATA (Does NOT overwrite existing production customizations)
-- =========================================================================

-- Seed Shop Settings singleton (preserves existing if already configured)
INSERT INTO public.shop_settings (id, shop_name, min_order_amount, delivery_fee, free_delivery_threshold)
VALUES (1, 'Chandu Chicken Center', 0.00, 30.00, 499.00)
ON CONFLICT (id) DO NOTHING;

-- Seed All 6 Categories (preserves existing if already configured)
INSERT INTO public.categories (id, name, slug, description, image_url, display_order)
VALUES
    ('cat-fresh-cuts', 'Fresh Chicken Cuts', 'fresh-chicken-cuts', 'Daily fresh tender chicken cleaned with RO water', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80', 1),
    ('cat-specialty', 'Biryani & Curry Cuts', 'biryani-curry-cuts', 'Curated bone-in & boneless pieces for Biryani & gravies', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80', 2),
    ('cat-boneless', 'Boneless & Fillets', 'boneless-fillets', 'Lean high-protein chicken breast and thigh fillets', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80', 3),
    ('cat-appetizers', 'Drumsticks & Wings', 'drumsticks-wings', 'Juicy chicken drumsticks and lollipop cuts', 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80', 4),
    ('cat-country', 'Country Chicken (Natukodi)', 'country-chicken-natukodi', 'Authentic free-range desi country chicken with rustic flavor', 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80', 5),
    ('cat-eggs', 'Farm Fresh Eggs', 'farm-fresh-eggs', 'Nutrient-rich, farm-laid white & country brown table eggs', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80', 6)
ON CONFLICT (id) DO NOTHING;

-- Seed Complete 9 Products Catalog (preserves existing if already configured)
INSERT INTO public.products (id, category_id, name, slug, description, image_url, cut_options, weights, is_available, is_featured, badge, net_weight_description)
VALUES
    ('prod-curry-cut', 'cat-fresh-cuts', 'Fresh Chicken Curry Cut (Skinless)', 'fresh-chicken-curry-cut-skinless', 'Tender, juicy bone-in pieces crafted from farm-raised young chicken. Includes mix of drumstick, thigh, breast and back pieces ideal for Indian curries and gravies. 100% halal cleaned with RO water.', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80', '["Standard Curry Cut (12-16 pcs/kg)", "Small Bites (South Indian Gravy Cut)", "Skin-On Traditional Cut"]'::jsonb, '[{"weight":"250g","price":65,"inStock":true},{"weight":"500g","price":125,"inStock":true},{"weight":"1kg","price":240,"inStock":true}]'::jsonb, true, true, 'Bestseller', 'Cleaned net weight. Exact weight as billed.'),
    ('prod-biryani-cut', 'cat-specialty', 'Chicken Biryani Cut (Large Juicy Pieces)', 'chicken-biryani-cut-large-juicy-pieces', 'Specially handpicked larger succulent cuts with bone that absorb biryani masalas deep into the marrow while retaining moisture during slow Dum cooking.', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=80', '["Classic Dum Biryani Cut (8-10 pcs/kg)", "Medium Biryani Cut"]'::jsonb, '[{"weight":"500g","price":135,"inStock":true},{"weight":"1kg","price":260,"inStock":true}]'::jsonb, true, true, 'Biryani Special', 'Premium large pieces with bone.'),
    ('prod-boneless-breast', 'cat-boneless', 'Tender Chicken Boneless Breast', 'tender-chicken-boneless-breast', 'High-protein, ultra-clean breast fillets trimmed of all excess fat and skin. Perfect for fitness enthusiasts, chicken tikka, stir-fries, and butter chicken.', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=80', '["Whole Breast Fillets", "Bite-Sized Cubes (Tikka Cut)", "Thin Strips"]'::jsonb, '[{"weight":"250g","price":95,"inStock":true},{"weight":"500g","price":180,"inStock":true},{"weight":"1kg","price":350,"inStock":true}]'::jsonb, true, true, 'High Protein', '100% boneless, zero wastage.'),
    ('prod-drumsticks', 'cat-appetizers', 'Juicy Chicken Drumsticks (Legs)', 'juicy-chicken-drumsticks-legs', 'Skinless tender chicken drumsticks with bone, carved for quick marination and rich roasting, tandoori grills, or rich Chettinad leg roast.', 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80', '["Skinless with Deep Slits (Easy Marinate)", "Standard Whole Drumsticks"]'::jsonb, '[{"weight":"500g","price":165,"inStock":true},{"weight":"1kg","price":320,"inStock":true}]'::jsonb, true, true, 'Kids Favorite', 'Approx 4-5 pcs per 500g.'),
    ('prod-lollipops', 'cat-appetizers', 'Chicken Lollipop (Frenched Winglets)', 'chicken-lollipop-frenched-winglets', 'Neatly frenched chicken wings shaped into lollipop drumettes with clean bone handle, ready for crispy Schezwan or spiced Indo-Chinese coating.', 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=800&q=80', '["Frenched Winglets (Ready to Batter)"]'::jsonb, '[{"weight":"250g","price":95,"inStock":true},{"weight":"500g","price":185,"inStock":true},{"weight":"1kg","price":360,"inStock":true}]'::jsonb, true, false, 'Party Starter', 'Clean trimmed bone tips.'),
    ('prod-country-chicken', 'cat-country', 'Authentic Country Chicken / Natukodi', 'authentic-country-chicken-natukodi', 'Free-range country chicken raised in villages on natural grains. Offers intense, deeply savory flavor and firm texture prized for authentic Telugu Natukodi Pulusu.', 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=800&q=80', '["Skin-On Lightly Singed (Traditional Char)", "Skinless Country Cut"]'::jsonb, '[{"weight":"500g","price":235,"inStock":true},{"weight":"1kg","price":460,"inStock":true}]'::jsonb, true, true, 'Speciality Item', 'Free-range desi bird. Takes longer to cook.'),
    ('prod-whole-chicken', 'cat-fresh-cuts', 'Whole Fresh Chicken (Skinless & Dressed)', 'whole-fresh-chicken-skinless-dressed', 'Full dressed tender young broiler chicken, gutted, neck removed, washed with RO water. Ready for whole roasting or custom butchering at home.', 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=800&q=80', '["Whole Dressed Bird", "Halved (2 halves)", "Quartered (4 pieces)"]'::jsonb, '[{"weight":"1kg","price":220,"inStock":true}]'::jsonb, true, false, 'Great Value', 'Net bird weight 1.0 kg - 1.1 kg.'),
    ('prod-liver-gizzard', 'cat-fresh-cuts', 'Fresh Chicken Liver & Gizzard Mix', 'fresh-chicken-liver-gizzard-mix', 'Freshly cleaned nutrient-dense iron-rich chicken liver and firm gizzards, thoroughly washed and cleaned. Great for spicy dry roasts.', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', '["Cleaned Mix (Liver + Gizzard)", "Liver Only", "Gizzard Only"]'::jsonb, '[{"weight":"250g","price":60,"inStock":true},{"weight":"500g","price":110,"inStock":true}]'::jsonb, true, false, 'High Iron', 'Cleaned thoroughly with RO water.'),
    ('prod-farm-eggs', 'cat-eggs', 'Farm Fresh White Table Eggs (Pack of 12)', 'farm-fresh-white-table-eggs-pack-12', 'Clean, unfertilized, graded white eggs from healthy hens fed a balanced grain diet. Packed in sturdy eco-friendly egg crates to prevent breakage during transit.', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=800&q=80', '["Pack of 12 Eggs", "Pack of 24 Eggs"]'::jsonb, '[{"weight":"500g","price":90,"inStock":true},{"weight":"1kg","price":170,"inStock":true}]'::jsonb, true, false, 'Daily Essential', 'Carefully cushioned packaging.')
ON CONFLICT (id) DO NOTHING;

-- Seed Product Weights (preserves existing if already configured)
INSERT INTO public.product_weights (product_id, weight, price, in_stock)
VALUES
    ('prod-curry-cut', '250g', 65, true),
    ('prod-curry-cut', '500g', 125, true),
    ('prod-curry-cut', '1kg', 240, true),
    ('prod-biryani-cut', '500g', 135, true),
    ('prod-biryani-cut', '1kg', 260, true),
    ('prod-boneless-breast', '250g', 95, true),
    ('prod-boneless-breast', '500g', 180, true),
    ('prod-boneless-breast', '1kg', 350, true),
    ('prod-drumsticks', '500g', 165, true),
    ('prod-drumsticks', '1kg', 320, true),
    ('prod-lollipops', '250g', 95, true),
    ('prod-lollipops', '500g', 185, true),
    ('prod-lollipops', '1kg', 360, true),
    ('prod-country-chicken', '500g', 235, true),
    ('prod-country-chicken', '1kg', 460, true),
    ('prod-whole-chicken', '1kg', 220, true),
    ('prod-liver-gizzard', '250g', 60, true),
    ('prod-liver-gizzard', '500g', 110, true),
    ('prod-farm-eggs', '500g', 90, true),
    ('prod-farm-eggs', '1kg', 170, true)
ON CONFLICT (product_id, weight) DO NOTHING;

-- =========================================================================
-- 7. HOW TO AUTHORIZE YOUR ADMINISTRATOR ACCOUNT (MANUAL STEP)
-- =========================================================================
-- Security Notice:
--   Users are NOT automatically promoted to administrator.
--   To safely authorize your verified shop owner account:
--
--   Step 1: Go to Supabase Dashboard -> Authentication -> Users.
--           Ensure your administrator user account is created with your real email.
--
--   Step 2: Run the following single statement in SQL Editor (replace with your email):
--           SELECT public.authorize_admin_by_email('your-admin-email@example.com');
--
--           Alternatively, you can run the direct insert statement:
--           INSERT INTO public.admin_users (id, email, role)
--           SELECT id, email, 'super_admin'
--           FROM auth.users
--           WHERE lower(email) = lower('your-admin-email@example.com')
--           ON CONFLICT (id) DO NOTHING;
-- =========================================================================

-- =========================================================================
-- 8. RELOAD POSTGREST SCHEMA CACHE
-- =========================================================================
NOTIFY pgrst, 'reload schema';
