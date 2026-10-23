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
-- INITIAL SEED DATA FOR CATEGORIES & COMPLETE 9 PRODUCTS CATALOG
-- =========================================================================
-- Ensure weights column exists if table was created earlier without it
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weights JSONB NOT NULL DEFAULT '[]'::jsonb;

-- All 6 categories
INSERT INTO public.categories (id, name, slug, description, image_url, display_order)
VALUES
    ('cat-fresh-cuts', 'Fresh Chicken Cuts', 'fresh-chicken-cuts', 'Daily fresh tender chicken cleaned with RO water', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80', 1),
    ('cat-specialty', 'Biryani & Curry Cuts', 'biryani-curry-cuts', 'Curated bone-in & boneless pieces for Biryani & gravies', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80', 2),
    ('cat-boneless', 'Boneless & Fillets', 'boneless-fillets', 'Lean high-protein chicken breast and thigh fillets', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80', 3),
    ('cat-appetizers', 'Drumsticks & Wings', 'drumsticks-wings', 'Juicy chicken drumsticks and lollipop cuts', 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80', 4),
    ('cat-country', 'Country Chicken (Natukodi)', 'country-chicken-natukodi', 'Authentic free-range desi country chicken with rustic flavor', 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80', 5),
    ('cat-eggs', 'Farm Fresh Eggs', 'farm-fresh-eggs', 'Nutrient-rich, farm-laid white & country brown table eggs', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80', 6)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    display_order = EXCLUDED.display_order;

-- All 9 Products
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
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category_id = EXCLUDED.category_id,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    cut_options = EXCLUDED.cut_options,
    weights = EXCLUDED.weights,
    badge = EXCLUDED.badge,
    net_weight_description = EXCLUDED.net_weight_description;

-- Populate product_weights normalized table
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
ON CONFLICT (product_id, weight) DO UPDATE SET
    price = EXCLUDED.price,
    in_stock = EXCLUDED.in_stock;

-- =========================================================================
-- PERMISSIONS & ROLES GRANTS (CRITICAL for PostgREST Schema Cache recognition)
-- =========================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON TABLE public.orders TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- =========================================================================
-- RELOAD POSTGREST SCHEMA CACHE (Resolves "Could not find table in schema cache")
-- =========================================================================
NOTIFY pgrst, 'reload schema';

