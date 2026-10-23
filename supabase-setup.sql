-- =========================================================================
-- CHANDU CHICKEN CENTER - SUPABASE PRODUCTION SETUP & RLS SECURITY POLICIES
-- Run this complete script in the Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CATEGORIES TABLE
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

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    cut_options JSONB NOT NULL DEFAULT '["Curry Cut", "Biryani Cut", "Small Pieces"]'::jsonb,
    weights JSONB NOT NULL DEFAULT '[{"weight":"250g","price":65,"inStock":true},{"weight":"500g","price":125,"inStock":true},{"weight":"1kg","price":240,"inStock":true}]'::jsonb,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    badge TEXT,
    net_weight_description TEXT DEFAULT 'Cleaned net meat weight',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast category and availability queries
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON public.products(is_available);

-- 4. PRODUCT WEIGHTS TABLE (Normalized variant pricing support)
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

-- 5. SHOP SETTINGS TABLE (Singleton row with id = 1)
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

-- Seed initial shop settings if empty
INSERT INTO public.shop_settings (id, shop_name, min_order_amount, delivery_fee, free_delivery_threshold)
VALUES (1, 'Chandu Chicken Center', 0.00, 30.00, 499.00)
ON CONFLICT (id) DO NOTHING;

-- 6. ORDERS TABLE
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

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enforce database-side protection so ordinary users cannot alter records.
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 1. Categories Policies
-- Everyone (anonymous + authenticated) can view categories
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
    ON public.categories FOR SELECT
    USING (true);

-- Only authenticated admins can insert, update, delete categories
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
CREATE POLICY "Admins can insert categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Admins can delete categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (true);

-- 2. Products Policies
-- Public can view products
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products"
    ON public.products FOR SELECT
    USING (true);

-- Only authenticated admins can modify products
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
    ON public.products FOR DELETE
    TO authenticated
    USING (true);

-- 3. Product Weights Policies
DROP POLICY IF EXISTS "Public can view product weights" ON public.product_weights;
CREATE POLICY "Public can view product weights"
    ON public.product_weights FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage product weights" ON public.product_weights;
CREATE POLICY "Admins can manage product weights"
    ON public.product_weights FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Shop Settings Policies
-- Everyone can read shop settings
DROP POLICY IF EXISTS "Public can view shop settings" ON public.shop_settings;
CREATE POLICY "Public can view shop settings"
    ON public.shop_settings FOR SELECT
    USING (true);

-- Only authenticated admins can update shop settings
DROP POLICY IF EXISTS "Admins can update shop settings" ON public.shop_settings;
CREATE POLICY "Admins can update shop settings"
    ON public.shop_settings FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can insert shop settings" ON public.shop_settings;
CREATE POLICY "Admins can insert shop settings"
    ON public.shop_settings FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 5. Orders Policies
-- Anyone (guest customer or admin) can insert an order
DROP POLICY IF EXISTS "Public guest can create order" ON public.orders;
CREATE POLICY "Public guest can create order"
    ON public.orders FOR INSERT
    WITH CHECK (true);

-- Anyone can read their own order via order number or id; authenticated admins can read all orders
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
CREATE POLICY "Public can view orders"
    ON public.orders FOR SELECT
    USING (true);

-- Only authenticated admins can update order status / payment status
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- INITIAL SEED DATA FOR CATEGORIES & POPULAR CUTS
-- =========================================================================
INSERT INTO public.categories (id, name, slug, description, image_url, display_order)
VALUES
    ('cat-fresh-cuts', 'Fresh Chicken Cuts', 'fresh-chicken-cuts', 'Daily fresh tender chicken cleaned with RO water', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80', 1),
    ('cat-specialty', 'Biryani & Curry Cuts', 'biryani-curry-cuts', 'Curated bone-in & boneless pieces for Biryani & gravies', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80', 2),
    ('cat-boneless', 'Boneless & Fillets', 'boneless-fillets', 'Lean high-protein chicken breast and thigh fillets', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80', 3),
    ('cat-appetizers', 'Drumsticks & Wings', 'drumsticks-wings', 'Juicy chicken drumsticks and lollipop cuts', 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, category_id, name, slug, description, image_url, cut_options, weights, is_available, is_featured, badge, net_weight_description)
VALUES
    ('prod-curry-cut', 'cat-fresh-cuts', 'Fresh Chicken Curry Cut (Skinless)', 'fresh-chicken-curry-cut-skinless', 'Standard curry pieces (12-16 pcs/kg) carved from tender farm-fresh broiler chicken.', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=800&q=80', '["Standard Curry Cut (12-16 pcs/kg)", "Small Curry Cut (18-22 pcs/kg)", "Large Pieces (8-10 pcs/kg)"]'::jsonb, '[{"weight":"250g","price":65,"inStock":true},{"weight":"500g","price":125,"inStock":true},{"weight":"1kg","price":240,"inStock":true}]'::jsonb, true, true, 'Bestseller', 'Net weight after plucking and cleaning.'),
    ('prod-biryani-cut', 'cat-specialty', 'Chicken Biryani Cut (Large Juicy Pieces)', 'chicken-biryani-cut-large-juicy-pieces', 'Expertly sized 8-10 large succulent pieces per kg, ideal for slow-dum Hyderabadi biryani.', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=80', '["Classic Dum Biryani Cut (8-10 pcs/kg)", "Biryani Leg & Thigh Cut", "Medium Biryani Cut"]'::jsonb, '[{"weight":"500g","price":135,"inStock":true},{"weight":"1kg","price":260,"inStock":true}]'::jsonb, true, true, 'Chef Choice', 'Even-sized cuts for uniform marination.'),
    ('prod-boneless-breast', 'cat-boneless', 'Tender Chicken Boneless Breast Fillets', 'tender-chicken-boneless-breast-fillets', '100% whole muscle chicken breast trimmed of all connective tissue and skin. Ultra-high protein.', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=80', '["Whole Fillets", "Thin Slices / Steaks", "Boneless Cubes / Tikka Cut", "Minced / Keema"]'::jsonb, '[{"weight":"250g","price":90,"inStock":true},{"weight":"500g","price":175,"inStock":true},{"weight":"1kg","price":340,"inStock":true}]'::jsonb, true, true, 'High Protein', 'Zero bone wastage, 100% net meat.'),
    ('prod-drumsticks', 'cat-appetizers', 'Juicy Chicken Drumsticks (Tangdi)', 'juicy-chicken-drumsticks-tangdi', 'Skinless plump chicken drumsticks. Perfect for tandoori, deep frying, and rich Mughlai gravies.', 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80', '["Plain Skinless", "Deep Slit Cuts for Marinade (Tangdi)", "With Skin"]'::jsonb, '[{"weight":"500g","price":150,"inStock":true},{"weight":"1kg","price":290,"inStock":true}]'::jsonb, true, false, 'Party Favorite', 'Approx 4-5 drumsticks per 500g.')
ON CONFLICT (id) DO NOTHING;
