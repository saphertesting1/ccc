-- =========================================================================
-- CHANDU CHICKEN CENTER - PRODUCTION POSTGRESQL RELATIONAL SCHEMA
-- Database: PostgreSQL 14+
-- =========================================================================

-- Enable UUID extension if supported
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    category_id VARCHAR(64) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    cut_options JSONB NOT NULL DEFAULT '["Curry Cut", "Biryani Cut", "Small Pieces"]'::jsonb,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    badge VARCHAR(50),
    net_weight_description VARCHAR(100) DEFAULT 'Net weight after cleaning',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);

-- 3. PRODUCT WEIGHT AND PRICE OPTIONS (Normalized variant pricing)
CREATE TABLE IF NOT EXISTS product_weights (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    weight VARCHAR(10) NOT NULL CHECK (weight IN ('250g', '500g', '1kg')),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, weight)
);

CREATE INDEX IF NOT EXISTS idx_product_weights_pid ON product_weights(product_id);

-- 4. PRODUCT IMAGE REFERENCES TABLE (For multi-image support & storage providers)
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local', -- 'local', 's3', 'cloudinary'
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ADMIN ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'shop_manager', -- 'super_admin', 'shop_manager'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SHOP SETTINGS TABLE (Singleton row or key-value store)
CREATE TABLE IF NOT EXISTS shop_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    shop_name VARCHAR(100) NOT NULL DEFAULT 'Chandu Chicken Center',
    tagline VARCHAR(200) NOT NULL DEFAULT '100% Farm Fresh Tender Chicken Delivered in 45 Mins',
    shop_phone VARCHAR(20) NOT NULL DEFAULT '+91 98480 22338',
    shop_whatsapp VARCHAR(20) NOT NULL DEFAULT '+91 98480 22338',
    address TEXT NOT NULL DEFAULT 'Shop No. 4, Main Road, Market Junction, Near RTC Bus Stand',
    landmark VARCHAR(150) DEFAULT 'Opposite Rythu Bazar',
    city VARCHAR(100) NOT NULL DEFAULT 'Hyderabad / Vijayawada',
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    open_time VARCHAR(10) NOT NULL DEFAULT '07:00 AM',
    close_time VARCHAR(10) NOT NULL DEFAULT '09:00 PM',
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    free_delivery_threshold NUMERIC(10, 2) NOT NULL DEFAULT 499.00,
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    delivery_time_estimate_mins INTEGER NOT NULL DEFAULT 45,
    announcement_banner TEXT DEFAULT 'Today Special: Fresh Country Chicken (Natukodi) available! Order before 11 AM.',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_shop_settings_row CHECK (id = 1)
);

-- 7. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(30) UNIQUE NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    delivery_address TEXT NOT NULL,
    landmark VARCHAR(150),
    customer_notes TEXT,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('COD', 'UPI')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'New' CHECK (order_status IN ('New', 'Accepted', 'Preparing', 'Ready for Dispatch', 'Out for Delivery', 'Delivered', 'Rejected', 'Cancelled')),
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 8. ORDER ITEMS (Immutable snapshot of price and weight at time of order)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    weight VARCHAR(10) NOT NULL,
    cut_preference VARCHAR(100) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 9. ORDER STATUS HISTORY TABLE (Audit trail of every status transition)
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON order_status_history(order_id);

-- 10. PAYMENT ATTEMPTS & TRANSACTIONS (Prepared for Future UPI Integration)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_provider VARCHAR(50) NOT NULL, -- e.g. 'phonepe', 'razorpay', 'cashfree'
    provider_transaction_id VARCHAR(100),
    idempotency_token VARCHAR(100) UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(5) DEFAULT 'INR',
    status VARCHAR(30) NOT NULL, -- 'initiated', 'pending', 'success', 'failed', 'timed_out'
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_order_id ON payment_transactions(order_id);
