-- =====================================================
-- DROP TABLES
-- =====================================================
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS customer_profiles CASCADE;
DROP TABLE IF EXISTS staff_profiles CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS service_options CASCADE;
DROP TABLE IF EXISTS tier_packages CASCADE;
DROP TABLE IF EXISTS tier_features CASCADE;
DROP TABLE IF EXISTS b2b_accounts CASCADE;
DROP TABLE IF EXISTS b2b_locations CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS quote_answers CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS uploads CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS proof_versions CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS message_threads CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS gallery_images CASCADE;
DROP TABLE IF EXISTS case_studies CASCADE;
DROP TABLE IF EXISTS marketing_content CASCADE;
DROP TABLE IF EXISTS tier_checklist_items CASCADE;
DROP TABLE IF EXISTS contact_inquiries CASCADE;
DROP TABLE IF EXISTS contract_pricing CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS material_consumption_rules CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS calendar_settings CASCADE;
DROP TABLE IF EXISTS blackout_dates CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS guest_quote_tokens CASCADE;

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CUSTOMER',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Customer profiles
CREATE TABLE customer_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    phone TEXT,
    company_name TEXT,
    address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Staff profiles
CREATE TABLE staff_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    department TEXT,
    permissions TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Service categories
CREATE TABLE service_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Services
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES service_categories(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    requires_booking BOOLEAN NOT NULL DEFAULT false,
    requires_proof BOOLEAN NOT NULL DEFAULT false,
    is_top_seller BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    slot_duration_hours NUMERIC NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Service options
CREATE TABLE service_options (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id),
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'TEXT',
    required BOOLEAN NOT NULL DEFAULT false,
    choices TEXT,
    pricing_impact TEXT,
    help_text TEXT,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Tier packages
CREATE TABLE tier_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Tier features
CREATE TABLE tier_features (
    id TEXT PRIMARY KEY,
    tier_id TEXT NOT NULL REFERENCES tier_packages(id),
    group_name TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    feature_label TEXT NOT NULL,
    feature_value TEXT,
    is_included BOOLEAN NOT NULL DEFAULT true,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- B2B accounts (needed before quotes due to foreign key in orders -> b2b_locations)
CREATE TABLE b2b_accounts (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    main_contact_user_id TEXT NOT NULL REFERENCES users(id),
    contract_start TEXT,
    contract_end TEXT,
    terms TEXT,
    payment_terms TEXT NOT NULL DEFAULT 'NET_30',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- B2B locations
CREATE TABLE b2b_locations (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES b2b_accounts(id),
    label TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Quotes
CREATE TABLE quotes (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES users(id),
    service_id TEXT NOT NULL REFERENCES services(id),
    tier_id TEXT NOT NULL REFERENCES tier_packages(id),
    status TEXT NOT NULL DEFAULT 'SUBMITTED',
    estimate_subtotal NUMERIC,
    final_subtotal NUMERIC,
    notes TEXT,
    is_guest BOOLEAN NOT NULL DEFAULT false,
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    guest_company_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Quote answers
CREATE TABLE quote_answers (
    id TEXT PRIMARY KEY,
    quote_id TEXT NOT NULL REFERENCES quotes(id),
    option_key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Orders
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    quote_id TEXT REFERENCES quotes(id),
    customer_id TEXT REFERENCES users(id),
    tier_id TEXT REFERENCES tier_packages(id),
    order_type TEXT NOT NULL DEFAULT 'SERVICE',
    status TEXT NOT NULL DEFAULT 'QUOTE_REQUESTED',
    due_at TEXT,
    total_subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    deposit_pct NUMERIC NOT NULL DEFAULT 50,
    deposit_amount NUMERIC NOT NULL DEFAULT 0,
    revision_count NUMERIC NOT NULL DEFAULT 0,
    assigned_staff_id TEXT REFERENCES users(id),
    location_id TEXT REFERENCES b2b_locations(id),
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    guest_address TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Uploads
CREATE TABLE uploads (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL REFERENCES users(id),
    quote_id TEXT REFERENCES quotes(id),
    order_id TEXT REFERENCES orders(id),
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes NUMERIC NOT NULL DEFAULT 0,
    dpi_warning BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL
);

-- Bookings
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    quote_id TEXT NOT NULL REFERENCES quotes(id),
    customer_id TEXT NOT NULL REFERENCES users(id),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    urgent_fee_pct NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Proof versions
CREATE TABLE proof_versions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    version_number NUMERIC NOT NULL DEFAULT 1,
    file_url TEXT NOT NULL,
    created_by_staff_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'SENT',
    customer_comment TEXT,
    internal_notes TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Invoices
CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    invoice_number TEXT NOT NULL UNIQUE,
    amount_due NUMERIC NOT NULL DEFAULT 0,
    issued_at TEXT NOT NULL,
    paid_at TEXT
);

-- Payments
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    amount NUMERIC NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'STRIPE',
    status TEXT NOT NULL DEFAULT 'PENDING',
    transaction_ref TEXT,
    recorded_by_admin_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Message threads
CREATE TABLE message_threads (
    id TEXT PRIMARY KEY,
    quote_id TEXT REFERENCES quotes(id),
    order_id TEXT REFERENCES orders(id),
    created_at TEXT NOT NULL
);

-- Messages
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES message_threads(id),
    sender_user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL
);

-- Settings
CREATE TABLE settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Audit logs
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    metadata TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
);

-- Gallery images
CREATE TABLE gallery_images (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    description TEXT,
    alt_text TEXT,
    categories TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Case studies
CREATE TABLE case_studies (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    service_id TEXT NOT NULL REFERENCES services(id),
    tier_id TEXT NOT NULL REFERENCES tier_packages(id),
    gallery_image_id TEXT NOT NULL REFERENCES gallery_images(id),
    description TEXT,
    client_testimonial TEXT,
    additional_images TEXT,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Marketing content
CREATE TABLE marketing_content (
    id TEXT PRIMARY KEY,
    page_key TEXT NOT NULL,
    section_key TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(page_key, section_key)
);

-- Tier checklist items
CREATE TABLE tier_checklist_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    feature_id TEXT NOT NULL REFERENCES tier_features(id),
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TEXT,
    completed_by_staff_id TEXT REFERENCES users(id)
);

-- Contact inquiries
CREATE TABLE contact_inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    service_interested_in TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL
);

-- Contract pricing
CREATE TABLE contract_pricing (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES b2b_accounts(id),
    service_id TEXT NOT NULL REFERENCES services(id),
    pricing_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Inventory items
CREATE TABLE inventory_items (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    qty_on_hand NUMERIC NOT NULL DEFAULT 0,
    reorder_point NUMERIC NOT NULL DEFAULT 0,
    reorder_qty NUMERIC NOT NULL DEFAULT 0,
    supplier_name TEXT,
    cost_per_unit NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Material consumption rules
CREATE TABLE material_consumption_rules (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id),
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
    rule_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Purchase orders
CREATE TABLE purchase_orders (
    id TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    ordered_at TEXT,
    received_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Purchase order items
CREATE TABLE purchase_order_items (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
    qty NUMERIC NOT NULL DEFAULT 0,
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Inventory transactions
CREATE TABLE inventory_transactions (
    id TEXT PRIMARY KEY,
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
    transaction_type TEXT NOT NULL DEFAULT 'ADDITION',
    qty NUMERIC NOT NULL DEFAULT 0,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);

-- Calendar settings
CREATE TABLE calendar_settings (
    id TEXT PRIMARY KEY,
    working_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    start_hour NUMERIC NOT NULL DEFAULT 9,
    end_hour NUMERIC NOT NULL DEFAULT 18,
    slot_duration_minutes NUMERIC NOT NULL DEFAULT 120,
    slots_per_day NUMERIC NOT NULL DEFAULT 4,
    emergency_slots_per_day NUMERIC NOT NULL DEFAULT 2,
    updated_at TEXT NOT NULL
);

-- Blackout dates
CREATE TABLE blackout_dates (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    email_order_updates BOOLEAN NOT NULL DEFAULT true,
    email_proof_ready BOOLEAN NOT NULL DEFAULT true,
    email_messages BOOLEAN NOT NULL DEFAULT true,
    email_marketing BOOLEAN NOT NULL DEFAULT false,
    updated_at TEXT NOT NULL
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL
);

-- Sessions
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
);

-- Guest quote access tokens (magic links)
CREATE TABLE guest_quote_tokens (
    id TEXT PRIMARY KEY,
    quote_id TEXT NOT NULL REFERENCES quotes(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL
);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert users (admin, staff, customers)
INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES
('user_admin_001', 'Admin User', 'admin@printshop.com', 'admin123', 'ADMIN', true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('user_staff_001', 'John Designer', 'john.designer@printshop.com', 'staff123', 'STAFF', true, '2024-01-05T09:00:00Z', '2024-01-05T09:00:00Z'),
('user_staff_002', 'Sarah Manager', 'sarah.manager@printshop.com', 'staff123', 'STAFF', true, '2024-01-05T09:30:00Z', '2024-01-05T09:30:00Z'),
('user_staff_003', 'Mike Production', 'mike.production@printshop.com', 'staff123', 'STAFF', true, '2024-01-06T08:00:00Z', '2024-01-06T08:00:00Z'),
('user_cust_001', 'Alice Johnson', 'alice.johnson@example.com', 'password123', 'CUSTOMER', true, '2024-01-10T10:00:00Z', '2024-01-10T10:00:00Z'),
('user_cust_002', 'Bob Smith', 'bob.smith@example.com', 'password123', 'CUSTOMER', true, '2024-01-12T11:00:00Z', '2024-01-12T11:00:00Z'),
('user_cust_003', 'Carol Williams', 'carol.williams@example.com', 'password123', 'CUSTOMER', true, '2024-01-15T14:00:00Z', '2024-01-15T14:00:00Z'),
('user_cust_004', 'David Brown', 'david.brown@example.com', 'password123', 'CUSTOMER', true, '2024-01-18T09:30:00Z', '2024-01-18T09:30:00Z'),
('user_cust_005', 'Emma Davis', 'emma.davis@example.com', 'password123', 'CUSTOMER', true, '2024-01-20T13:00:00Z', '2024-01-20T13:00:00Z'),
('user_cust_006', 'Frank Miller', 'frank.miller@example.com', 'password123', 'CUSTOMER', true, '2024-01-22T10:30:00Z', '2024-01-22T10:30:00Z'),
('user_cust_007', 'Grace Wilson', 'grace.wilson@techcorp.com', 'password123', 'CUSTOMER', true, '2024-01-25T11:00:00Z', '2024-01-25T11:00:00Z'),
('user_cust_008', 'Henry Moore', 'henry.moore@startup.io', 'password123', 'CUSTOMER', true, '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z'),
('user_cust_009', 'Iris Taylor', 'iris.taylor@agency.com', 'password123', 'CUSTOMER', true, '2024-02-03T15:00:00Z', '2024-02-03T15:00:00Z'),
('user_cust_010', 'Jack Anderson', 'jack.anderson@enterprise.com', 'password123', 'CUSTOMER', true, '2024-02-05T10:00:00Z', '2024-02-05T10:00:00Z');

-- Insert customer profiles
INSERT INTO customer_profiles (id, user_id, phone, company_name, address, created_at, updated_at) VALUES
('cp_001', 'user_cust_001', '+1-555-0101', 'Alice Designs', '123 Main St, New York, NY 10001', '2024-01-10T10:00:00Z', '2024-01-10T10:00:00Z'),
('cp_002', 'user_cust_002', '+1-555-0102', 'Bob''s Marketing', '456 Oak Ave, Los Angeles, CA 90001', '2024-01-12T11:00:00Z', '2024-01-12T11:00:00Z'),
('cp_003', 'user_cust_003', '+1-555-0103', NULL, '789 Pine Rd, Chicago, IL 60601', '2024-01-15T14:00:00Z', '2024-01-15T14:00:00Z'),
('cp_004', 'user_cust_004', '+1-555-0104', 'Brown Industries', '321 Elm St, Houston, TX 77001', '2024-01-18T09:30:00Z', '2024-01-18T09:30:00Z'),
('cp_005', 'user_cust_005', '+1-555-0105', NULL, '654 Maple Dr, Phoenix, AZ 85001', '2024-01-20T13:00:00Z', '2024-01-20T13:00:00Z'),
('cp_006', 'user_cust_006', '+1-555-0106', 'Miller Corp', '987 Cedar Ln, Philadelphia, PA 19101', '2024-01-22T10:30:00Z', '2024-01-22T10:30:00Z'),
('cp_007', 'user_cust_007', '+1-555-0107', 'TechCorp Solutions', '111 Tech Plaza, San Francisco, CA 94101', '2024-01-25T11:00:00Z', '2024-01-25T11:00:00Z'),
('cp_008', 'user_cust_008', '+1-555-0108', 'StartupHub Inc', '222 Innovation Way, Austin, TX 78701', '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z'),
('cp_009', 'user_cust_009', '+1-555-0109', 'Creative Agency Pro', '333 Design Blvd, Seattle, WA 98101', '2024-02-03T15:00:00Z', '2024-02-03T15:00:00Z'),
('cp_010', 'user_cust_010', '+1-555-0110', 'Enterprise Global', '444 Business Park, Boston, MA 02101', '2024-02-05T10:00:00Z', '2024-02-05T10:00:00Z');

-- Insert staff profiles
INSERT INTO staff_profiles (id, user_id, department, permissions, created_at, updated_at) VALUES
('sp_001', 'user_admin_001', 'Administration', '{"all": true}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('sp_002', 'user_staff_001', 'Design', '{"quotes": true, "orders": true, "proofs": true}', '2024-01-05T09:00:00Z', '2024-01-05T09:00:00Z'),
('sp_003', 'user_staff_002', 'Management', '{"quotes": true, "orders": true, "customers": true, "reports": true}', '2024-01-05T09:30:00Z', '2024-01-05T09:30:00Z'),
('sp_004', 'user_staff_003', 'Production', '{"orders": true, "inventory": true}', '2024-01-06T08:00:00Z', '2024-01-06T08:00:00Z');

-- Insert service categories
INSERT INTO service_categories (id, name, slug, sort_order, is_active, created_at, updated_at) VALUES
('cat_001', 'Business Printing', 'business-printing', 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('cat_002', 'Marketing Materials', 'marketing-materials', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('cat_003', 'Large Format Printing', 'large-format-printing', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('cat_004', 'Promotional Products', 'promotional-products', 4, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('cat_005', 'Signage', 'signage', 5, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert services
INSERT INTO services (id, category_id, name, slug, description, requires_booking, requires_proof, is_top_seller, is_active, slot_duration_hours, created_at, updated_at) VALUES
('svc_001', 'cat_001', 'Business Cards', 'business-cards', 'Professional business cards in various finishes and materials', false, true, true, true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_002', 'cat_001', 'Letterheads', 'letterheads', 'Custom letterhead printing on premium paper stock', false, true, false, true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_003', 'cat_001', 'Envelopes', 'envelopes', 'Branded envelope printing in all standard sizes', false, false, false, true, 0.5, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_004', 'cat_002', 'Brochures', 'brochures', 'Tri-fold and bi-fold brochure printing', false, true, true, true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_005', 'cat_002', 'Flyers', 'flyers', 'High-impact flyer printing for promotions and events', false, true, true, true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_006', 'cat_002', 'Postcards', 'postcards', 'Custom postcard printing for direct mail campaigns', false, true, false, true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_007', 'cat_003', 'Banners', 'banners', 'Vinyl banner printing for indoor and outdoor use', true, true, true, true, 3, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_008', 'cat_003', 'Posters', 'posters', 'Large format poster printing on various materials', false, true, false, true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_009', 'cat_003', 'Vehicle Wraps', 'vehicle-wraps', 'Full and partial vehicle wrap design and installation', true, true, false, true, 8, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_010', 'cat_004', 'T-Shirts', 't-shirts', 'Custom t-shirt printing and embroidery', false, true, true, true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_011', 'cat_004', 'Promotional Pens', 'promotional-pens', 'Branded pen printing in bulk quantities', false, false, false, true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_012', 'cat_005', 'Outdoor Signage', 'outdoor-signage', 'Weather-resistant outdoor business signage', true, true, true, true, 4, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('svc_013', 'cat_005', 'Window Graphics', 'window-graphics', 'Custom window decals and graphics', true, true, false, true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert service options
INSERT INTO service_options (id, service_id, key, label, type, required, choices, pricing_impact, help_text, sort_order, is_active, created_at, updated_at) VALUES
('opt_001', 'svc_001', 'quantity', 'Quantity', 'SELECT', true, '["250", "500", "1000", "2500", "5000"]', '{"250": 50, "500": 80, "1000": 120, "2500": 250, "5000": 400}', 'Select the number of business cards', 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_002', 'svc_001', 'finish', 'Finish', 'SELECT', true, '["Matte", "Glossy", "Silk", "Spot UV"]', '{"Matte": 0, "Glossy": 0, "Silk": 10, "Spot UV": 30}', 'Choose your preferred finish', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_003', 'svc_001', 'paper_weight', 'Paper Weight', 'SELECT', true, '["14pt", "16pt", "18pt"]', '{"14pt": 0, "16pt": 5, "18pt": 10}', 'Thickness of the card stock', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_004', 'svc_004', 'quantity', 'Quantity', 'SELECT', true, '["100", "250", "500", "1000", "2500"]', '{"100": 80, "250": 150, "500": 250, "1000": 400, "2500": 850}', 'Number of brochures', 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_005', 'svc_004', 'fold_type', 'Fold Type', 'SELECT', true, '["Tri-fold", "Bi-fold", "Z-fold"]', '{"Tri-fold": 0, "Bi-fold": 0, "Z-fold": 10}', 'How the brochure will be folded', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_006', 'svc_004', 'paper_type', 'Paper Type', 'SELECT', true, '["Gloss Cover", "Matte Cover", "Premium Silk"]', '{"Gloss Cover": 0, "Matte Cover": 0, "Premium Silk": 20}', 'Type of paper stock', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_007', 'svc_007', 'size', 'Banner Size', 'SELECT', true, '["3x6 ft", "4x8 ft", "5x10 ft", "6x12 ft"]', '{"3x6 ft": 80, "4x8 ft": 150, "5x10 ft": 250, "6x12 ft": 400}', 'Select banner dimensions', 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_008', 'svc_007', 'material', 'Material', 'SELECT', true, '["13oz Vinyl", "15oz Vinyl", "Mesh"]', '{"13oz Vinyl": 0, "15oz Vinyl": 20, "Mesh": 15}', 'Banner material type', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_009', 'svc_007', 'grommets', 'Grommet Placement', 'SELECT', true, '["All 4 Corners", "Every 2 feet", "Every 18 inches"]', '{"All 4 Corners": 0, "Every 2 feet": 10, "Every 18 inches": 20}', 'Spacing of mounting grommets', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_010', 'svc_010', 'quantity', 'Quantity', 'SELECT', true, '["12", "24", "50", "100", "250"]', '{"12": 150, "24": 250, "50": 400, "100": 700, "250": 1500}', 'Number of t-shirts', 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_011', 'svc_010', 'printing_method', 'Printing Method', 'SELECT', true, '["Screen Print", "Direct to Garment", "Heat Transfer"]', '{"Screen Print": 0, "Direct to Garment": 50, "Heat Transfer": 30}', 'Choose printing technique', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('opt_012', 'svc_010', 'colors', 'Number of Colors', 'SELECT', true, '["1 Color", "2 Colors", "3 Colors", "Full Color"]', '{"1 Color": 0, "2 Colors": 50, "3 Colors": 100, "Full Color": 150}', 'Number of ink colors in design', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert tier packages
INSERT INTO tier_packages (id, name, slug, description, is_active, sort_order, created_at, updated_at) VALUES
('tier_001', 'Basic', 'basic', 'Essential printing services with standard turnaround', true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('tier_002', 'Standard', 'standard', 'Enhanced services with faster turnaround and more options', true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('tier_003', 'Premium', 'premium', 'Priority service with premium materials and quick turnaround', true, 3, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('tier_004', 'Enterprise', 'enterprise', 'Dedicated account management with custom solutions', true, 4, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert tier features
INSERT INTO tier_features (id, tier_id, group_name, feature_key, feature_label, feature_value, is_included, sort_order, created_at, updated_at) VALUES
('feat_001', 'tier_001', 'Turnaround', 'turnaround_time', 'Turnaround Time', '7-10 business days', true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_002', 'tier_001', 'Turnaround', 'rush_available', 'Rush Service Available', NULL, false, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_003', 'tier_001', 'Design', 'design_proofs', 'Design Proofs', '1 proof round', true, 3, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_004', 'tier_001', 'Design', 'revisions', 'Revisions', '2 revisions', true, 4, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_005', 'tier_001', 'Support', 'account_manager', 'Dedicated Account Manager', NULL, false, 5, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_006', 'tier_002', 'Turnaround', 'turnaround_time', 'Turnaround Time', '5-7 business days', true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_007', 'tier_002', 'Turnaround', 'rush_available', 'Rush Service Available', 'Available (+20%)', true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_008', 'tier_002', 'Design', 'design_proofs', 'Design Proofs', '2 proof rounds', true, 3, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_009', 'tier_002', 'Design', 'revisions', 'Revisions', '4 revisions', true, 4, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_010', 'tier_002', 'Support', 'account_manager', 'Dedicated Account Manager', NULL, false, 5, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_011', 'tier_003', 'Turnaround', 'turnaround_time', 'Turnaround Time', '3-5 business days', true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_012', 'tier_003', 'Turnaround', 'rush_available', 'Rush Service Available', 'Available (+15%)', true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_013', 'tier_003', 'Design', 'design_proofs', 'Design Proofs', '3 proof rounds', true, 3, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_014', 'tier_003', 'Design', 'revisions', 'Revisions', 'Unlimited', true, 4, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_015', 'tier_003', 'Support', 'account_manager', 'Dedicated Account Manager', NULL, true, 5, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_016', 'tier_004', 'Turnaround', 'turnaround_time', 'Turnaround Time', '1-3 business days', true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_017', 'tier_004', 'Turnaround', 'rush_available', 'Rush Service Available', 'Same day available', true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_018', 'tier_004', 'Design', 'design_proofs', 'Design Proofs', 'Unlimited proofs', true, 3, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_019', 'tier_004', 'Design', 'revisions', 'Revisions', 'Unlimited', true, 4, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('feat_020', 'tier_004', 'Support', 'account_manager', 'Dedicated Account Manager', 'Senior account manager', true, 5, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert B2B accounts
INSERT INTO b2b_accounts (id, company_name, main_contact_user_id, contract_start, contract_end, terms, payment_terms, is_active, created_at, updated_at) VALUES
('b2b_001', 'TechCorp Solutions', 'user_cust_007', '2024-01-01', '2024-12-31', 'Annual contract with volume discounts', 'NET_30', true, '2024-01-25T11:00:00Z', '2024-01-25T11:00:00Z'),
('b2b_002', 'Enterprise Global', 'user_cust_010', '2024-02-01', '2025-01-31', 'Multi-location contract with dedicated account manager', 'NET_45', true, '2024-02-05T10:00:00Z', '2024-02-05T10:00:00Z');

-- Insert B2B locations
INSERT INTO b2b_locations (id, account_id, label, address, contact_name, contact_phone, is_active, created_at, updated_at) VALUES
('loc_001', 'b2b_001', 'HQ - San Francisco', '111 Tech Plaza, San Francisco, CA 94101', 'Grace Wilson', '+1-555-0107', true, '2024-01-25T11:30:00Z', '2024-01-25T11:30:00Z'),
('loc_002', 'b2b_001', 'Branch - New York', '555 Silicon Alley, New York, NY 10013', 'Tom Richards', '+1-555-0201', true, '2024-01-25T11:35:00Z', '2024-01-25T11:35:00Z'),
('loc_003', 'b2b_002', 'HQ - Boston', '444 Business Park, Boston, MA 02101', 'Jack Anderson', '+1-555-0110', true, '2024-02-05T10:30:00Z', '2024-02-05T10:30:00Z'),
('loc_004', 'b2b_002', 'Branch - Chicago', '999 Corporate Dr, Chicago, IL 60601', 'Linda Martinez', '+1-555-0202', true, '2024-02-05T10:35:00Z', '2024-02-05T10:35:00Z');

-- Insert quotes
INSERT INTO quotes (id, customer_id, service_id, tier_id, status, estimate_subtotal, final_subtotal, notes, created_at, updated_at) VALUES
('quote_001', 'user_cust_001', 'svc_001', 'tier_002', 'APPROVED', 120, 125, 'Customer requested matte finish', '2024-01-11T10:00:00Z', '2024-01-12T14:30:00Z'),
('quote_002', 'user_cust_002', 'svc_004', 'tier_001', 'APPROVED', 250, 250, 'Standard tri-fold brochure', '2024-01-13T11:00:00Z', '2024-01-14T09:15:00Z'),
('quote_003', 'user_cust_003', 'svc_007', 'tier_002', 'APPROVED', 150, 165, 'Outdoor banner with grommets every 2 feet', '2024-01-16T14:00:00Z', '2024-01-17T16:20:00Z'),
('quote_004', 'user_cust_004', 'svc_010', 'tier_003', 'APPROVED', 700, 750, 'Screen print with 2 colors', '2024-01-19T09:30:00Z', '2024-01-20T11:00:00Z'),
('quote_005', 'user_cust_005', 'svc_005', 'tier_001', 'APPROVED', 180, 180, 'Promotional flyers for event', '2024-01-21T13:00:00Z', '2024-01-22T10:00:00Z'),
('quote_006', 'user_cust_006', 'svc_012', 'tier_002', 'APPROVED', 450, 480, 'Outdoor signage with installation', '2024-01-23T10:30:00Z', '2024-01-24T15:00:00Z'),
('quote_007', 'user_cust_007', 'svc_001', 'tier_003', 'APPROVED', 400, 420, 'Premium business cards with spot UV', '2024-01-26T11:00:00Z', '2024-01-27T13:30:00Z'),
('quote_008', 'user_cust_008', 'svc_004', 'tier_002', 'SUBMITTED', 400, NULL, 'Need quote for marketing brochures', '2024-02-02T09:00:00Z', '2024-02-02T09:00:00Z'),
('quote_009', 'user_cust_009', 'svc_007', 'tier_003', 'APPROVED', 250, 275, 'Large banner for trade show', '2024-02-04T15:00:00Z', '2024-02-05T10:30:00Z'),
('quote_010', 'user_cust_010', 'svc_010', 'tier_004', 'APPROVED', 1500, 1650, 'Corporate branded t-shirts for entire team', '2024-02-06T10:00:00Z', '2024-02-07T14:00:00Z'),
('quote_011', 'user_cust_001', 'svc_005', 'tier_001', 'SUBMITTED', NULL, NULL, 'Requesting quote for 1000 flyers', '2024-02-08T11:00:00Z', '2024-02-08T11:00:00Z'),
('quote_012', 'user_cust_002', 'svc_008', 'tier_002', 'IN_REVIEW', 180, NULL, 'Large poster printing', '2024-02-09T13:00:00Z', '2024-02-09T13:00:00Z');

-- Insert quote answers
INSERT INTO quote_answers (id, quote_id, option_key, value, created_at) VALUES
('qa_001', 'quote_001', 'quantity', '1000', '2024-01-11T10:00:00Z'),
('qa_002', 'quote_001', 'finish', 'Matte', '2024-01-11T10:00:00Z'),
('qa_003', 'quote_001', 'paper_weight', '16pt', '2024-01-11T10:00:00Z'),
('qa_004', 'quote_002', 'quantity', '500', '2024-01-13T11:00:00Z'),
('qa_005', 'quote_002', 'fold_type', 'Tri-fold', '2024-01-13T11:00:00Z'),
('qa_006', 'quote_002', 'paper_type', 'Gloss Cover', '2024-01-13T11:00:00Z'),
('qa_007', 'quote_003', 'size', '4x8 ft', '2024-01-16T14:00:00Z'),
('qa_008', 'quote_003', 'material', '13oz Vinyl', '2024-01-16T14:00:00Z'),
('qa_009', 'quote_003', 'grommets', 'Every 2 feet', '2024-01-16T14:00:00Z'),
('qa_010', 'quote_004', 'quantity', '100', '2024-01-19T09:30:00Z'),
('qa_011', 'quote_004', 'printing_method', 'Screen Print', '2024-01-19T09:30:00Z'),
('qa_012', 'quote_004', 'colors', '2 Colors', '2024-01-19T09:30:00Z'),
('qa_013', 'quote_007', 'quantity', '5000', '2024-01-26T11:00:00Z'),
('qa_014', 'quote_007', 'finish', 'Spot UV', '2024-01-26T11:00:00Z'),
('qa_015', 'quote_007', 'paper_weight', '18pt', '2024-01-26T11:00:00Z');

-- Insert orders
INSERT INTO orders (id, quote_id, customer_id, tier_id, status, due_at, total_subtotal, tax_amount, total_amount, deposit_pct, deposit_amount, revision_count, assigned_staff_id, location_id, created_at, updated_at) VALUES
('order_001', 'quote_001', 'user_cust_001', 'tier_002', 'COMPLETED', '2024-01-25T17:00:00Z', 125, 10, 135, 50, 67.5, 1, 'user_staff_001', NULL, '2024-01-12T15:00:00Z', '2024-01-26T16:00:00Z'),
('order_002', 'quote_002', 'user_cust_002', 'tier_001', 'COMPLETED', '2024-01-28T17:00:00Z', 250, 20, 270, 50, 135, 0, 'user_staff_001', NULL, '2024-01-14T10:00:00Z', '2024-01-29T15:00:00Z'),
('order_003', 'quote_003', 'user_cust_003', 'tier_002', 'IN_PRODUCTION', '2024-02-12T17:00:00Z', 165, 13.2, 178.2, 50, 89.1, 2, 'user_staff_002', NULL, '2024-01-17T17:00:00Z', '2024-02-08T10:00:00Z'),
('order_004', 'quote_004', 'user_cust_004', 'tier_003', 'PROOF_SENT', '2024-02-10T17:00:00Z', 750, 60, 810, 50, 405, 0, 'user_staff_001', NULL, '2024-01-20T12:00:00Z', '2024-02-06T14:00:00Z'),
('order_005', 'quote_005', 'user_cust_005', 'tier_001', 'COMPLETED', '2024-02-05T17:00:00Z', 180, 14.4, 194.4, 50, 97.2, 1, 'user_staff_002', NULL, '2024-01-22T11:00:00Z', '2024-02-06T16:00:00Z'),
('order_006', 'quote_006', 'user_cust_006', 'tier_002', 'READY_FOR_PICKUP', '2024-02-15T17:00:00Z', 480, 38.4, 518.4, 50, 259.2, 1, 'user_staff_003', NULL, '2024-01-24T16:00:00Z', '2024-02-13T15:00:00Z'),
('order_007', 'quote_007', 'user_cust_007', 'tier_003', 'IN_PRODUCTION', '2024-02-18T17:00:00Z', 420, 33.6, 453.6, 50, 226.8, 0, 'user_staff_001', 'loc_001', '2024-01-27T14:00:00Z', '2024-02-10T11:00:00Z'),
('order_009', 'quote_009', 'user_cust_009', 'tier_003', 'AWAITING_APPROVAL', '2024-02-20T17:00:00Z', 275, 22, 297, 50, 148.5, 1, 'user_staff_002', NULL, '2024-02-05T11:00:00Z', '2024-02-11T10:00:00Z'),
('order_010', 'quote_010', 'user_cust_010', 'tier_004', 'APPROVED', '2024-02-25T17:00:00Z', 1650, 132, 1782, 50, 891, 0, 'user_staff_001', 'loc_003', '2024-02-07T15:00:00Z', '2024-02-12T09:00:00Z');

-- Insert uploads
INSERT INTO uploads (id, owner_user_id, quote_id, order_id, file_url, file_type, file_name, file_size_bytes, dpi_warning, created_at) VALUES
('upload_001', 'user_cust_001', 'quote_001', 'order_001', 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb', 'image/png', 'business-card-design.png', 2456789, false, '2024-01-11T10:15:00Z'),
('upload_002', 'user_cust_002', 'quote_002', 'order_002', 'https://images.unsplash.com/photo-1634942537034-2531766767d1', 'application/pdf', 'brochure-draft.pdf', 5234576, false, '2024-01-13T11:20:00Z'),
('upload_003', 'user_cust_003', 'quote_003', 'order_003', 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf', 'image/jpeg', 'banner-artwork.jpg', 8976543, true, '2024-01-16T14:30:00Z'),
('upload_004', 'user_cust_004', 'quote_004', 'order_004', 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f', 'image/png', 'tshirt-design.png', 3456789, false, '2024-01-19T09:45:00Z'),
('upload_005', 'user_cust_005', 'quote_005', 'order_005', 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338', 'image/jpeg', 'flyer-design.jpg', 4567890, false, '2024-01-21T13:15:00Z'),
('upload_006', 'user_cust_007', 'quote_007', 'order_007', 'https://images.unsplash.com/photo-1634987824334-039c4226c0e0', 'application/pdf', 'corporate-card-design.pdf', 3789012, false, '2024-01-26T11:30:00Z'),
('upload_007', 'user_cust_009', 'quote_009', 'order_009', 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf', 'image/png', 'trade-show-banner.png', 9876543, false, '2024-02-04T15:20:00Z');

-- Insert bookings
INSERT INTO bookings (id, quote_id, customer_id, start_at, end_at, status, is_emergency, urgent_fee_pct, created_at, updated_at) VALUES
('booking_001', 'quote_003', 'user_cust_003', '2024-01-20T09:00:00Z', '2024-01-20T12:00:00Z', 'CONFIRMED', false, 0, '2024-01-16T14:30:00Z', '2024-01-17T16:20:00Z'),
('booking_002', 'quote_006', 'user_cust_006', '2024-01-28T13:00:00Z', '2024-01-28T17:00:00Z', 'COMPLETED', false, 0, '2024-01-23T10:45:00Z', '2024-01-28T17:30:00Z'),
('booking_003', 'quote_009', 'user_cust_009', '2024-02-10T10:00:00Z', '2024-02-10T13:00:00Z', 'CONFIRMED', false, 0, '2024-02-04T15:30:00Z', '2024-02-05T10:30:00Z'),
('booking_004', 'quote_007', 'user_cust_007', '2024-02-12T14:00:00Z', '2024-02-12T15:00:00Z', 'PENDING', true, 25, '2024-01-26T11:45:00Z', '2024-01-27T13:30:00Z');

-- Insert proof versions
INSERT INTO proof_versions (id, order_id, version_number, file_url, created_by_staff_id, status, customer_comment, internal_notes, approved_at, created_at, updated_at) VALUES
('proof_001', 'order_001', 1, 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb', 'user_staff_001', 'APPROVED', 'Looks perfect!', 'First proof sent', '2024-01-15T14:00:00Z', '2024-01-13T10:00:00Z', '2024-01-15T14:00:00Z'),
('proof_002', 'order_002', 1, 'https://images.unsplash.com/photo-1634942537034-2531766767d1', 'user_staff_001', 'APPROVED', 'Approved to print', 'Clean design approved', '2024-01-16T11:00:00Z', '2024-01-15T09:00:00Z', '2024-01-16T11:00:00Z'),
('proof_003', 'order_003', 1, 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf', 'user_staff_002', 'REVISION_REQUESTED', 'Can we adjust the logo size?', 'Logo needs to be larger', NULL, '2024-01-19T10:00:00Z', '2024-01-19T10:00:00Z'),
('proof_004', 'order_003', 2, 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c', 'user_staff_002', 'APPROVED', 'Perfect now, thanks!', 'Logo resized as requested', '2024-01-22T15:00:00Z', '2024-01-20T14:00:00Z', '2024-01-22T15:00:00Z'),
('proof_005', 'order_004', 1, 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f', 'user_staff_001', 'SENT', NULL, 'Awaiting customer feedback', NULL, '2024-02-06T14:00:00Z', '2024-02-06T14:00:00Z'),
('proof_006', 'order_005', 1, 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338', 'user_staff_002', 'APPROVED', 'Great work!', 'Quick approval', '2024-01-25T10:00:00Z', '2024-01-24T09:00:00Z', '2024-01-25T10:00:00Z'),
('proof_007', 'order_009', 1, 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf', 'user_staff_002', 'SENT', NULL, 'First proof for trade show banner', NULL, '2024-02-11T10:00:00Z', '2024-02-11T10:00:00Z');

-- Insert invoices
INSERT INTO invoices (id, order_id, invoice_number, amount_due, issued_at, paid_at) VALUES
('inv_001', 'order_001', 'INV-2024-0001', 135, '2024-01-12T15:00:00Z', '2024-01-13T10:30:00Z'),
('inv_002', 'order_002', 'INV-2024-0002', 270, '2024-01-14T10:00:00Z', '2024-01-15T14:15:00Z'),
('inv_003', 'order_003', 'INV-2024-0003', 178.2, '2024-01-17T17:00:00Z', '2024-01-18T09:45:00Z'),
('inv_004', 'order_004', 'INV-2024-0004', 810, '2024-01-20T12:00:00Z', '2024-01-22T11:20:00Z'),
('inv_005', 'order_005', 'INV-2024-0005', 194.4, '2024-01-22T11:00:00Z', '2024-01-23T16:00:00Z'),
('inv_006', 'order_006', 'INV-2024-0006', 518.4, '2024-01-24T16:00:00Z', '2024-01-26T10:30:00Z'),
('inv_007', 'order_007', 'INV-2024-0007', 453.6, '2024-01-27T14:00:00Z', '2024-02-10T15:00:00Z'),
('inv_009', 'order_009', 'INV-2024-0009', 297, '2024-02-05T11:00:00Z', NULL),
('inv_010', 'order_010', 'INV-2024-0010', 1782, '2024-02-07T15:00:00Z', '2024-02-08T09:30:00Z');

-- Insert payments
INSERT INTO payments (id, order_id, amount, method, status, transaction_ref, recorded_by_admin_id, created_at, updated_at) VALUES
('pay_001', 'order_001', 67.5, 'STRIPE', 'COMPLETED', 'ch_3ABC123DEF456', NULL, '2024-01-13T10:30:00Z', '2024-01-13T10:30:00Z'),
('pay_002', 'order_001', 67.5, 'STRIPE', 'COMPLETED', 'ch_3ABC789GHI012', NULL, '2024-01-26T15:00:00Z', '2024-01-26T15:00:00Z'),
('pay_003', 'order_002', 135, 'STRIPE', 'COMPLETED', 'ch_3DEF345JKL678', NULL, '2024-01-15T14:15:00Z', '2024-01-15T14:15:00Z'),
('pay_004', 'order_002', 135, 'STRIPE', 'COMPLETED', 'ch_3DEF901MNO234', NULL, '2024-01-29T14:30:00Z', '2024-01-29T14:30:00Z'),
('pay_005', 'order_003', 89.1, 'STRIPE', 'COMPLETED', 'ch_3GHI567PQR890', NULL, '2024-01-18T09:45:00Z', '2024-01-18T09:45:00Z'),
('pay_006', 'order_004', 405, 'CHECK', 'COMPLETED', 'CHK-5678', 'user_admin_001', '2024-01-22T11:20:00Z', '2024-01-22T11:20:00Z'),
('pay_007', 'order_005', 97.2, 'STRIPE', 'COMPLETED', 'ch_3JKL123STU456', NULL, '2024-01-23T16:00:00Z', '2024-01-23T16:00:00Z'),
('pay_008', 'order_005', 97.2, 'STRIPE', 'COMPLETED', 'ch_3JKL789VWX012', NULL, '2024-02-06T15:30:00Z', '2024-02-06T15:30:00Z'),
('pay_009', 'order_006', 259.2, 'STRIPE', 'COMPLETED', 'ch_3MNO345YZA678', NULL, '2024-01-26T10:30:00Z', '2024-01-26T10:30:00Z'),
('pay_010', 'order_007', 226.8, 'WIRE', 'COMPLETED', 'WIRE-2024-001', 'user_admin_001', '2024-02-10T15:00:00Z', '2024-02-10T15:00:00Z'),
('pay_011', 'order_010', 891, 'CHECK', 'COMPLETED', 'CHK-9012', 'user_admin_001', '2024-02-08T09:30:00Z', '2024-02-08T09:30:00Z');

-- Insert message threads
INSERT INTO message_threads (id, quote_id, order_id, created_at) VALUES
('thread_001', 'quote_001', 'order_001', '2024-01-11T10:30:00Z'),
('thread_002', 'quote_003', 'order_003', '2024-01-16T14:30:00Z'),
('thread_003', 'quote_004', 'order_004', '2024-01-19T10:00:00Z'),
('thread_004', 'quote_007', 'order_007', '2024-01-26T12:00:00Z'),
('thread_005', 'quote_008', NULL, '2024-02-02T09:30:00Z');

-- Insert messages
INSERT INTO messages (id, thread_id, sender_user_id, body, is_read, created_at) VALUES
('msg_001', 'thread_001', 'user_cust_001', 'Hi, I''d like to confirm the matte finish for the business cards.', true, '2024-01-11T10:30:00Z'),
('msg_002', 'thread_001', 'user_staff_001', 'Absolutely! We''ll proceed with matte finish. I''ll send you a proof by tomorrow.', true, '2024-01-11T11:00:00Z'),
('msg_003', 'thread_001', 'user_cust_001', 'Perfect, thank you!', true, '2024-01-11T11:15:00Z'),
('msg_004', 'thread_002', 'user_cust_003', 'When can I schedule the banner installation?', true, '2024-01-16T14:30:00Z'),
('msg_005', 'thread_002', 'user_staff_002', 'We have availability next week. Would January 20th work for you?', true, '2024-01-16T15:00:00Z'),
('msg_006', 'thread_002', 'user_cust_003', 'That works perfectly. I''ll be there at 9 AM.', true, '2024-01-16T15:30:00Z'),
('msg_007', 'thread_003', 'user_cust_004', 'Can we change the t-shirt color to navy blue instead of black?', true, '2024-01-19T10:00:00Z'),
('msg_008', 'thread_003', 'user_staff_001', 'Yes, we can do navy blue. Let me update the quote for you.', true, '2024-01-19T10:30:00Z'),
('msg_009', 'thread_004', 'user_cust_007', 'These will be for our corporate office. Do you offer volume discounts?', true, '2024-01-26T12:00:00Z'),
('msg_010', 'thread_004', 'user_staff_001', 'Yes! Since you''re ordering 5000 cards, I can offer a 10% discount. I''ll update your quote.', true, '2024-01-26T13:00:00Z'),
('msg_011', 'thread_004', 'user_cust_007', 'Excellent, please proceed with that.', true, '2024-01-26T13:30:00Z'),
('msg_012', 'thread_005', 'user_cust_008', 'What''s the turnaround time for 1000 brochures?', false, '2024-02-02T09:30:00Z');

-- Insert settings
INSERT INTO settings (id, key, value, updated_at) VALUES
('setting_001', 'company_name', 'Premium Print Shop', '2024-01-01T08:00:00Z'),
('setting_002', 'company_email', 'info@printshop.com', '2024-01-01T08:00:00Z'),
('setting_003', 'company_phone', '+1-555-PRINT-00', '2024-01-01T08:00:00Z'),
('setting_004', 'tax_rate', '0.08', '2024-01-01T08:00:00Z'),
('setting_005', 'default_deposit_pct', '50', '2024-01-01T08:00:00Z'),
('setting_006', 'rush_fee_pct', '20', '2024-01-01T08:00:00Z'),
('setting_007', 'emergency_fee_pct', '35', '2024-01-01T08:00:00Z'),
('setting_008', 'maintenance_mode', 'false', '2024-01-01T08:00:00Z'),
('setting_009', 'max_file_upload_mb', '50', '2024-01-01T08:00:00Z'),
('setting_010', 'stripe_publishable_key', 'pk_test_51ABC123DEF456', '2024-01-01T08:00:00Z');

-- Insert audit logs
INSERT INTO audit_logs (id, user_id, action, object_type, object_id, metadata, ip_address, created_at) VALUES
('log_001', 'user_admin_001', 'LOGIN', 'USER', 'user_admin_001', '{"method": "email"}', '192.168.1.100', '2024-01-01T08:00:00Z'),
('log_002', 'user_staff_001', 'LOGIN', 'USER', 'user_staff_001', '{"method": "email"}', '192.168.1.101', '2024-01-05T09:00:00Z'),
('log_003', 'user_cust_001', 'CREATED', 'QUOTE', 'quote_001', '{"service": "Business Cards"}', '203.0.113.45', '2024-01-11T10:00:00Z'),
('log_004', 'user_staff_001', 'UPDATED', 'QUOTE', 'quote_001', '{"status": "APPROVED", "final_subtotal": 125}', '192.168.1.101', '2024-01-12T14:30:00Z'),
('log_005', 'user_cust_002', 'CREATED', 'QUOTE', 'quote_002', '{"service": "Brochures"}', '203.0.113.46', '2024-01-13T11:00:00Z'),
('log_006', 'user_admin_001', 'CREATED', 'ORDER', 'order_001', '{"quote_id": "quote_001"}', '192.168.1.100', '2024-01-12T15:00:00Z'),
('log_007', 'user_staff_001', 'UPDATED', 'ORDER', 'order_001', '{"status": "IN_PRODUCTION"}', '192.168.1.101', '2024-01-18T10:00:00Z'),
('log_008', 'user_cust_003', 'CREATED', 'QUOTE', 'quote_003', '{"service": "Banners"}', '203.0.113.47', '2024-01-16T14:00:00Z'),
('log_009', 'user_staff_002', 'CREATED', 'PROOF', 'proof_001', '{"order_id": "order_001", "version": 1}', '192.168.1.102', '2024-01-13T10:00:00Z'),
('log_010', 'user_cust_001', 'APPROVED', 'PROOF', 'proof_001', '{"version": 1}', '203.0.113.45', '2024-01-15T14:00:00Z');

-- Insert gallery images
INSERT INTO gallery_images (id, title, image_url, thumbnail_url, description, alt_text, categories, is_active, sort_order, created_at, updated_at) VALUES
('gallery_001', 'Premium Business Cards with Spot UV', 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb', 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=400', 'Elegant business cards with spot UV finish for a luxury feel', 'Black business cards with gold foil accent', '["business-cards", "spot-uv"]', true, 1, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_002', 'Corporate Brochure Design', 'https://images.unsplash.com/photo-1634942537034-2531766767d1', 'https://images.unsplash.com/photo-1634942537034-2531766767d1?w=400', 'Tri-fold brochure design for tech company', 'Modern tri-fold brochure layout', '["brochures", "marketing"]', true, 2, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_003', 'Large Format Trade Show Banner', 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf', 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400', 'Eye-catching 8x10 banner for trade show booth', 'Large colorful banner display', '["banners", "large-format", "trade-show"]', true, 3, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_004', 'Custom T-Shirt Design', 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f', 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400', 'Screen printed t-shirts for corporate event', 'White t-shirt with custom logo print', '["apparel", "t-shirts", "promotional"]', true, 4, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_005', 'Event Flyers', 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338', 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400', 'Vibrant flyer design for music festival', 'Colorful event flyer with bold typography', '["flyers", "marketing", "events"]', true, 5, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_006', 'Outdoor Business Signage', 'https://images.unsplash.com/photo-1565043666747-69f6646db940', 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400', 'Weather-resistant outdoor sign with LED illumination', 'Illuminated business sign at night', '["signage", "outdoor", "business"]', true, 6, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_007', 'Product Packaging Design', 'https://images.unsplash.com/photo-1612538498456-e861df91d4d1', 'https://images.unsplash.com/photo-1612538498456-e861df91d4d1?w=400', 'Luxury packaging design for cosmetics brand', 'Elegant product box packaging', '["packaging", "luxury"]', true, 7, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_008', 'Restaurant Menu Print', 'https://images.unsplash.com/photo-1578474846511-04ba529f0b88', 'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=400', 'Multi-page menu with food photography', 'Restaurant menu on wooden table', '["menus", "restaurant", "food"]', true, 8, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_009', 'Window Graphics Installation', 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04', 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=400', 'Storefront window decals with promotional messaging', 'Shop window with vinyl graphics', '["window-graphics", "signage", "retail"]', true, 9, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('gallery_010', 'Vehicle Wrap Design', 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d', 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400', 'Full vehicle wrap for delivery fleet', 'Van with colorful company branding', '["vehicle-wraps", "fleet", "large-format"]', true, 10, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert case studies
INSERT INTO case_studies (id, slug, title, service_id, tier_id, gallery_image_id, description, client_testimonial, additional_images, is_published, created_at, updated_at) VALUES
('case_001', 'tech-startup-rebrand', 'Tech Startup Complete Rebrand', 'svc_001', 'tier_003', 'gallery_001', 'Complete brand identity package including business cards, letterheads, and marketing materials for a growing tech startup. We worked closely with their team to create a modern, professional look that reflects their innovative spirit.', 'Working with Premium Print Shop was a game-changer for our brand. The quality exceeded our expectations and the turnaround was incredibly fast. - CEO, TechStart Inc.', '["https://images.unsplash.com/photo-1611162618071-b39a2ec055fb", "https://images.unsplash.com/photo-1634987824334-039c4226c0e0"]', true, '2024-01-15T10:00:00Z', '2024-01-15T10:00:00Z'),
('case_002', 'annual-conference-materials', 'Annual Conference Marketing Materials', 'svc_004', 'tier_002', 'gallery_002', 'Comprehensive marketing package for a major industry conference, including brochures, banners, and promotional materials. Delivered on time for 500+ attendees.', 'The team delivered exceptional quality on a tight deadline. Our conference materials looked amazing and really helped us stand out. - Event Manager, Global Conference Group', '["https://images.unsplash.com/photo-1634942537034-2531766767d1", "https://images.unsplash.com/photo-1540575467063-178a50c2df87"]', true, '2024-01-20T14:00:00Z', '2024-01-20T14:00:00Z'),
('case_003', 'retail-store-signage', 'Retail Store Grand Opening Signage', 'svc_012', 'tier_003', 'gallery_006', 'Complete signage solution for new retail location, including outdoor signage, window graphics, and interior wayfinding. Professional installation included.', 'From design to installation, everything was seamless. Our store looks incredible and we''ve received so many compliments on the signage. - Owner, Boutique Fashion', '["https://images.unsplash.com/photo-1565043666747-69f6646db940", "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04"]', true, '2024-01-25T11:00:00Z', '2024-01-25T11:00:00Z'),
('case_004', 'corporate-apparel-program', 'Corporate Branded Apparel Program', 'svc_010', 'tier_004', 'gallery_004', 'Large-scale branded apparel project for Fortune 500 company, including t-shirts, polos, and jackets for 500+ employees across multiple locations.', 'Premium Print Shop handled our complex multi-location rollout flawlessly. The quality is consistent across all items and locations. - HR Director, Enterprise Corp', '["https://images.unsplash.com/photo-1489987707025-afc232f7ea0f", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab"]', true, '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z');

-- Insert marketing content
INSERT INTO marketing_content (id, page_key, section_key, content, updated_at) VALUES
('mc_001', 'home', 'hero_heading', 'Your Vision, Printed to Perfection', '2024-01-01T08:00:00Z'),
('mc_002', 'home', 'hero_subheading', 'Professional printing services for businesses of all sizes. From business cards to large format banners, we bring your ideas to life.', '2024-01-01T08:00:00Z'),
('mc_003', 'home', 'hero_cta', 'Get a Free Quote', '2024-01-01T08:00:00Z'),
('mc_004', 'about', 'company_story', 'With over 20 years of experience in the printing industry, Premium Print Shop has become the trusted partner for businesses nationwide. Our commitment to quality, innovation, and customer service sets us apart.', '2024-01-01T08:00:00Z'),
('mc_005', 'about', 'mission_statement', 'Our mission is to deliver exceptional printing solutions that help our clients succeed. We combine cutting-edge technology with traditional craftsmanship to produce results that exceed expectations.', '2024-01-01T08:00:00Z'),
('mc_006', 'services', 'intro_text', 'We offer a comprehensive range of printing services designed to meet all your business needs. From small runs to large-scale productions, we have the expertise and equipment to deliver exceptional results.', '2024-01-01T08:00:00Z'),
('mc_007', 'testimonials', 'heading', 'What Our Clients Say', '2024-01-01T08:00:00Z'),
('mc_008', 'contact', 'office_hours', 'Monday - Friday: 8:00 AM - 6:00 PM | Saturday: 9:00 AM - 2:00 PM | Sunday: Closed', '2024-01-01T08:00:00Z');

-- Insert tier checklist items
INSERT INTO tier_checklist_items (id, order_id, feature_id, is_completed, completed_at, completed_by_staff_id) VALUES
('check_001', 'order_001', 'feat_008', true, '2024-01-13T10:00:00Z', 'user_staff_001'),
('check_002', 'order_001', 'feat_009', true, '2024-01-15T14:00:00Z', 'user_staff_001'),
('check_003', 'order_002', 'feat_003', true, '2024-01-15T09:00:00Z', 'user_staff_001'),
('check_004', 'order_002', 'feat_004', true, '2024-01-16T11:00:00Z', 'user_staff_001'),
('check_005', 'order_003', 'feat_008', true, '2024-01-19T10:00:00Z', 'user_staff_002'),
('check_006', 'order_003', 'feat_009', false, NULL, NULL),
('check_007', 'order_004', 'feat_013', true, '2024-02-06T14:00:00Z', 'user_staff_001'),
('check_008', 'order_004', 'feat_014', false, NULL, NULL);

-- Insert contact inquiries
INSERT INTO contact_inquiries (id, name, email, phone, service_interested_in, message, status, created_at) VALUES
('inq_001', 'Sarah Johnson', 'sarah.j@example.com', '+1-555-1234', 'Large Format Printing', 'I need a quote for printing several banners for an upcoming trade show. Can you help?', 'CONTACTED', '2024-01-15T09:30:00Z'),
('inq_002', 'Michael Chen', 'mchen@company.com', '+1-555-5678', 'Business Printing', 'Looking for a reliable printer for ongoing business card needs. What are your bulk pricing options?', 'CONTACTED', '2024-01-18T14:20:00Z'),
('inq_003', 'Lisa Martinez', 'lisa.m@startup.io', '+1-555-9012', 'Marketing Materials', 'We''re launching a new product and need brochures, flyers, and other marketing materials. Can we schedule a consultation?', 'NEW', '2024-02-05T11:45:00Z'),
('inq_004', 'Robert Taylor', 'rtaylor@enterprise.com', '+1-555-3456', 'Promotional Products', 'Interested in branded merchandise for employee gifts. What products do you offer?', 'NEW', '2024-02-08T10:15:00Z'),
('inq_005', 'Emily White', 'emily.white@agency.com', NULL, 'Signage', 'Need outdoor signage for a client''s new location. Do you handle installation?', 'CONVERTED', '2024-01-22T16:00:00Z');

-- Insert contract pricing
INSERT INTO contract_pricing (id, account_id, service_id, pricing_json, created_at, updated_at) VALUES
('cp_001', 'b2b_001', 'svc_001', '{"tier_002": {"base": 100, "per_1000": 90}, "tier_003": {"base": 110, "per_1000": 95}}', '2024-01-25T12:00:00Z', '2024-01-25T12:00:00Z'),
('cp_002', 'b2b_001', 'svc_004', '{"tier_002": {"base": 225, "per_500": 215}, "tier_003": {"base": 245, "per_500": 230}}', '2024-01-25T12:00:00Z', '2024-01-25T12:00:00Z'),
('cp_003', 'b2b_002', 'svc_001', '{"tier_003": {"base": 95, "per_1000": 85}, "tier_004": {"base": 105, "per_1000": 90}}', '2024-02-05T11:00:00Z', '2024-02-05T11:00:00Z'),
('cp_004', 'b2b_002', 'svc_010', '{"tier_003": {"base": 675, "per_100": 640}, "tier_004": {"base": 700, "per_100": 660}}', '2024-02-05T11:00:00Z', '2024-02-05T11:00:00Z');

-- Insert inventory items
INSERT INTO inventory_items (id, sku, name, unit, qty_on_hand, reorder_point, reorder_qty, supplier_name, cost_per_unit, is_active, created_at, updated_at) VALUES
('inv_001', 'PAPER-14PT-M', '14pt Matte Card Stock', 'sheet', 5000, 1000, 2500, 'Paper Suppliers Inc', 0.15, true, '2024-01-01T08:00:00Z', '2024-02-10T09:00:00Z'),
('inv_002', 'PAPER-16PT-G', '16pt Glossy Card Stock', 'sheet', 4500, 1000, 2500, 'Paper Suppliers Inc', 0.18, true, '2024-01-01T08:00:00Z', '2024-02-10T09:00:00Z'),
('inv_003', 'PAPER-18PT-S', '18pt Silk Card Stock', 'sheet', 3200, 800, 2000, 'Paper Suppliers Inc', 0.22, true, '2024-01-01T08:00:00Z', '2024-02-10T09:00:00Z'),
('inv_004', 'VINYL-13OZ', '13oz Vinyl Banner Material', 'roll', 12, 3, 6, 'Banner Supply Co', 85.00, true, '2024-01-01T08:00:00Z', '2024-02-05T10:00:00Z'),
('inv_005', 'VINYL-15OZ', '15oz Vinyl Banner Material', 'roll', 10, 3, 6, 'Banner Supply Co', 95.00, true, '2024-01-01T08:00:00Z', '2024-02-05T10:00:00Z'),
('inv_006', 'INK-CYAN', 'Cyan Ink Cartridge', 'cartridge', 25, 5, 15, 'Ink Solutions LLC', 45.00, true, '2024-01-01T08:00:00Z', '2024-02-08T11:00:00Z'),
('inv_007', 'INK-MAGENTA', 'Magenta Ink Cartridge', 'cartridge', 22, 5, 15, 'Ink Solutions LLC', 45.00, true, '2024-01-01T08:00:00Z', '2024-02-08T11:00:00Z'),
('inv_008', 'INK-YELLOW', 'Yellow Ink Cartridge', 'cartridge', 28, 5, 15, 'Ink Solutions LLC', 45.00, true, '2024-01-01T08:00:00Z', '2024-02-08T11:00:00Z'),
('inv_009', 'INK-BLACK', 'Black Ink Cartridge', 'cartridge', 30, 8, 20, 'Ink Solutions LLC', 42.00, true, '2024-01-01T08:00:00Z', '2024-02-08T11:00:00Z'),
('inv_010', 'TSHIRT-WHT-L', 'White T-Shirt - Large', 'piece', 150, 30, 100, 'Apparel Wholesale', 3.50, true, '2024-01-01T08:00:00Z', '2024-02-01T10:00:00Z'),
('inv_011', 'TSHIRT-BLK-L', 'Black T-Shirt - Large', 'piece', 120, 30, 100, 'Apparel Wholesale', 3.75, true, '2024-01-01T08:00:00Z', '2024-02-01T10:00:00Z'),
('inv_012', 'GROMMETS', 'Metal Grommets', 'box', 50, 10, 25, 'Hardware Supply', 12.00, true, '2024-01-01T08:00:00Z', '2024-01-28T14:00:00Z');

-- Insert material consumption rules
INSERT INTO material_consumption_rules (id, service_id, inventory_item_id, rule_json, created_at, updated_at) VALUES
('rule_001', 'svc_001', 'inv_001', '{"per_250": 260, "per_500": 520, "per_1000": 1040}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('rule_002', 'svc_001', 'inv_002', '{"per_250": 260, "per_500": 520, "per_1000": 1040}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('rule_003', 'svc_001', 'inv_003', '{"per_250": 260, "per_500": 520, "per_1000": 1040}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('rule_004', 'svc_007', 'inv_004', '{"per_sqft": 1.1}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('rule_005', 'svc_007', 'inv_005', '{"per_sqft": 1.1}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('rule_006', 'svc_010', 'inv_010', '{"per_unit": 1}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('rule_007', 'svc_010', 'inv_011', '{"per_unit": 1}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert purchase orders
INSERT INTO purchase_orders (id, supplier_name, status, ordered_at, received_at, notes, created_at, updated_at) VALUES
('po_001', 'Paper Suppliers Inc', 'RECEIVED', '2024-01-05T10:00:00Z', '2024-01-10T14:00:00Z', 'Monthly paper stock order', '2024-01-05T10:00:00Z', '2024-01-10T14:00:00Z'),
('po_002', 'Ink Solutions LLC', 'RECEIVED', '2024-01-15T11:00:00Z', '2024-01-20T09:00:00Z', 'Ink cartridge restock', '2024-01-15T11:00:00Z', '2024-01-20T09:00:00Z'),
('po_003', 'Banner Supply Co', 'RECEIVED', '2024-01-22T09:00:00Z', '2024-01-28T15:00:00Z', 'Vinyl material order', '2024-01-22T09:00:00Z', '2024-01-28T15:00:00Z'),
('po_004', 'Apparel Wholesale', 'ORDERED', '2024-02-05T10:00:00Z', NULL, 'T-shirt inventory replenishment', '2024-02-05T10:00:00Z', '2024-02-05T10:00:00Z'),
('po_005', 'Paper Suppliers Inc', 'DRAFT', NULL, NULL, 'Planning next month order', '2024-02-08T14:00:00Z', '2024-02-08T14:00:00Z');

-- Insert purchase order items
INSERT INTO purchase_order_items (id, purchase_order_id, inventory_item_id, qty, unit_cost, created_at) VALUES
('poi_001', 'po_001', 'inv_001', 2500, 0.15, '2024-01-05T10:00:00Z'),
('poi_002', 'po_001', 'inv_002', 2500, 0.18, '2024-01-05T10:00:00Z'),
('poi_003', 'po_001', 'inv_003', 2000, 0.22, '2024-01-05T10:00:00Z'),
('poi_004', 'po_002', 'inv_006', 15, 45.00, '2024-01-15T11:00:00Z'),
('poi_005', 'po_002', 'inv_007', 15, 45.00, '2024-01-15T11:00:00Z'),
('poi_006', 'po_002', 'inv_008', 15, 45.00, '2024-01-15T11:00:00Z'),
('poi_007', 'po_002', 'inv_009', 20, 42.00, '2024-01-15T11:00:00Z'),
('poi_008', 'po_003', 'inv_004', 6, 85.00, '2024-01-22T09:00:00Z'),
('poi_009', 'po_003', 'inv_005', 6, 95.00, '2024-01-22T09:00:00Z'),
('poi_010', 'po_004', 'inv_010', 100, 3.50, '2024-02-05T10:00:00Z'),
('poi_011', 'po_004', 'inv_011', 100, 3.75, '2024-02-05T10:00:00Z');

-- Insert inventory transactions
INSERT INTO inventory_transactions (id, inventory_item_id, transaction_type, qty, reference_type, reference_id, notes, created_at) VALUES
('trans_001', 'inv_001', 'ADDITION', 2500, 'PURCHASE_ORDER', 'po_001', 'Received from Paper Suppliers Inc', '2024-01-10T14:00:00Z'),
('trans_002', 'inv_002', 'ADDITION', 2500, 'PURCHASE_ORDER', 'po_001', 'Received from Paper Suppliers Inc', '2024-01-10T14:00:00Z'),
('trans_003', 'inv_003', 'ADDITION', 2000, 'PURCHASE_ORDER', 'po_001', 'Received from Paper Suppliers Inc', '2024-01-10T14:00:00Z'),
('trans_004', 'inv_001', 'CONSUMPTION', -1040, 'ORDER', 'order_001', 'Used for business cards order', '2024-01-18T10:00:00Z'),
('trans_005', 'inv_002', 'CONSUMPTION', -520, 'ORDER', 'order_002', 'Used for brochure order', '2024-01-20T11:00:00Z'),
('trans_006', 'inv_006', 'ADDITION', 15, 'PURCHASE_ORDER', 'po_002', 'Received from Ink Solutions LLC', '2024-01-20T09:00:00Z'),
('trans_007', 'inv_007', 'ADDITION', 15, 'PURCHASE_ORDER', 'po_002', 'Received from Ink Solutions LLC', '2024-01-20T09:00:00Z'),
('trans_008', 'inv_008', 'ADDITION', 15, 'PURCHASE_ORDER', 'po_002', 'Received from Ink Solutions LLC', '2024-01-20T09:00:00Z'),
('trans_009', 'inv_009', 'ADDITION', 20, 'PURCHASE_ORDER', 'po_002', 'Received from Ink Solutions LLC', '2024-01-20T09:00:00Z'),
('trans_010', 'inv_004', 'ADDITION', 6, 'PURCHASE_ORDER', 'po_003', 'Received from Banner Supply Co', '2024-01-28T15:00:00Z'),
('trans_011', 'inv_005', 'ADDITION', 6, 'PURCHASE_ORDER', 'po_003', 'Received from Banner Supply Co', '2024-01-28T15:00:00Z'),
('trans_012', 'inv_004', 'CONSUMPTION', -1, 'ORDER', 'order_003', 'Used for banner order', '2024-02-05T10:00:00Z'),
('trans_013', 'inv_010', 'CONSUMPTION', -100, 'ORDER', 'order_004', 'Used for t-shirt order', '2024-02-01T14:00:00Z');

-- Insert calendar settings
INSERT INTO calendar_settings (id, working_days, start_hour, end_hour, slot_duration_minutes, slots_per_day, emergency_slots_per_day, updated_at) VALUES
('cal_001', '[1,2,3,4,5]', 9, 18, 120, 4, 2, '2024-01-01T08:00:00Z');

-- Insert blackout dates
INSERT INTO blackout_dates (id, date, reason, created_at) VALUES
('blackout_001', '2024-12-25', 'Christmas Day', '2024-01-01T08:00:00Z'),
('blackout_002', '2024-12-26', 'Day after Christmas', '2024-01-01T08:00:00Z'),
('blackout_003', '2024-01-01', 'New Year''s Day', '2024-01-01T08:00:00Z'),
('blackout_004', '2024-07-04', 'Independence Day', '2024-01-01T08:00:00Z'),
('blackout_005', '2024-11-28', 'Thanksgiving Day', '2024-01-01T08:00:00Z'),
('blackout_006', '2024-11-29', 'Day after Thanksgiving', '2024-01-01T08:00:00Z');

-- Insert notification preferences
INSERT INTO notification_preferences (id, user_id, email_order_updates, email_proof_ready, email_messages, email_marketing, updated_at) VALUES
('notif_001', 'user_cust_001', true, true, true, false, '2024-01-10T10:00:00Z'),
('notif_002', 'user_cust_002', true, true, true, true, '2024-01-12T11:00:00Z'),
('notif_003', 'user_cust_003', true, true, false, false, '2024-01-15T14:00:00Z'),
('notif_004', 'user_cust_004', true, true, true, true, '2024-01-18T09:30:00Z'),
('notif_005', 'user_cust_005', true, true, true, false, '2024-01-20T13:00:00Z'),
('notif_006', 'user_cust_006', true, false, true, false, '2024-01-22T10:30:00Z'),
('notif_007', 'user_cust_007', true, true, true, true, '2024-01-25T11:00:00Z'),
('notif_008', 'user_cust_008', true, true, true, false, '2024-02-01T09:00:00Z'),
('notif_009', 'user_cust_009', true, true, true, true, '2024-02-03T15:00:00Z'),
('notif_010', 'user_cust_010', true, true, true, true, '2024-02-05T10:00:00Z');

-- Insert password reset tokens
INSERT INTO password_reset_tokens (id, user_id, token, expires_at, is_used, created_at) VALUES
('token_001', 'user_cust_003', 'reset_abc123def456ghi789', '2024-01-16T14:00:00Z', true, '2024-01-15T14:00:00Z'),
('token_002', 'user_cust_006', 'reset_xyz987wvu654tsr321', '2024-01-24T10:30:00Z', false, '2024-01-23T10:30:00Z');

-- Insert sessions
INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent, created_at) VALUES
('sess_001', 'user_admin_001', 'session_admin_abc123', '2024-03-01T08:00:00Z', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0', '2024-02-01T08:00:00Z'),
('sess_002', 'user_staff_001', 'session_staff_def456', '2024-03-01T09:00:00Z', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', '2024-02-01T09:00:00Z'),
('sess_003', 'user_staff_002', 'session_staff_ghi789', '2024-03-01T09:30:00Z', '192.168.1.102', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0', '2024-02-01T09:30:00Z'),
('sess_004', 'user_cust_001', 'session_cust_jkl012', '2024-02-20T10:00:00Z', '203.0.113.45', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Safari/604.1', '2024-02-10T10:00:00Z'),
('sess_005', 'user_cust_002', 'session_cust_mno345', '2024-02-20T11:00:00Z', '203.0.113.46', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0', '2024-02-10T11:00:00Z'),
('sess_006', 'user_cust_007', 'session_cust_pqr678', '2024-02-20T11:00:00Z', '203.0.113.50', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0', '2024-02-10T11:00:00Z'),
('sess_007', 'user_cust_010', 'session_cust_stu901', '2024-02-20T10:00:00Z', '203.0.113.55', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0', '2024-02-10T10:00:00Z');

-- =====================================================
-- PRODUCTS EXTENSION (Additive Migration)
-- =====================================================

-- Product categories (separate from service_categories)
CREATE TABLE IF NOT EXISTS product_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC NOT NULL DEFAULT 0,
    thumbnail_url TEXT,
    category_id TEXT REFERENCES product_categories(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    purchase_mode TEXT NOT NULL DEFAULT 'DIRECT_ONLY',
    config_schema TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Product variants (quantity/option combos with pricing)
CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    label TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    compare_at_price NUMERIC,
    discount_label TEXT,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Product images
CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    image_url TEXT NOT NULL,
    alt_text TEXT,
    sort_order NUMERIC NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL
);

-- Shopping carts
CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    guest_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_variant_id TEXT REFERENCES product_variants(id),
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    config_snapshot TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Order items (for product orders)
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    product_variant_id TEXT REFERENCES product_variants(id),
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    config_snapshot TEXT,
    created_at TEXT NOT NULL
);

-- Add order_type column to orders (if not exists)
-- Note: In PostgreSQL, we handle this with ALTER TABLE
-- For SQLite/simple execution, we check if column exists first

-- =====================================================
-- SEED DATA FOR PRODUCTS
-- =====================================================

-- Insert product categories
INSERT INTO product_categories (id, name, slug, sort_order, is_active, created_at, updated_at) VALUES
('pcat_001', 'Business Essentials', 'business-essentials', 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pcat_002', 'Marketing Materials', 'marketing-materials', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pcat_003', 'Stickers & Labels', 'stickers-labels', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pcat_004', 'Packaging', 'packaging', 4, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert products
INSERT INTO products (id, slug, name, description, base_price, thumbnail_url, category_id, is_active, purchase_mode, config_schema, created_at, updated_at) VALUES
('prod_001', 'business-cards', 'Business Cards', 'Premium business cards delivered to your doorstep. Choose from various paper types, finishes, and quantities.', 17.50, 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400', 'pcat_001', true, 'DIRECT_ONLY', '{"paperType":{"label":"Paper Type","options":[{"value":"standard","label":"Standard (350gsm)"},{"value":"premium","label":"Premium (400gsm)"}],"default":"standard"},"paperFinish":{"label":"Paper Finish","options":[{"value":"matte","label":"Matte"},{"value":"gloss","label":"Gloss"},{"value":"uncoated","label":"Uncoated"}],"default":"matte"},"printSides":{"label":"Print Sides","options":[{"value":"single","label":"Single-sided"},{"value":"double","label":"Double-sided"}],"default":"double"}}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('prod_002', 'flyers', 'Flyers', 'Eye-catching flyers for events, promotions, and announcements. Available in multiple sizes and finishes.', 25.00, 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400', 'pcat_002', true, 'DIRECT_ONLY', '{"size":{"label":"Size","options":[{"value":"a5","label":"A5 (148x210mm)"},{"value":"a4","label":"A4 (210x297mm)"},{"value":"dl","label":"DL (99x210mm)"}],"default":"a5"},"paperFinish":{"label":"Paper Finish","options":[{"value":"matte","label":"Matte"},{"value":"gloss","label":"Gloss"},{"value":"silk","label":"Silk"}],"default":"gloss"},"printSides":{"label":"Print Sides","options":[{"value":"single","label":"Single-sided"},{"value":"double","label":"Double-sided"}],"default":"single"}}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('prod_003', 'stickers', 'Custom Stickers', 'High-quality vinyl stickers perfect for branding, packaging, or promotions. Weather-resistant and durable.', 15.00, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', 'pcat_003', true, 'DIRECT_ONLY', '{"shape":{"label":"Shape","options":[{"value":"circle","label":"Circle"},{"value":"square","label":"Square"},{"value":"rectangle","label":"Rectangle"},{"value":"custom","label":"Custom Die-Cut"}],"default":"circle"},"size":{"label":"Size","options":[{"value":"small","label":"Small (50x50mm)"},{"value":"medium","label":"Medium (75x75mm)"},{"value":"large","label":"Large (100x100mm)"}],"default":"medium"},"finish":{"label":"Finish","options":[{"value":"gloss","label":"Gloss"},{"value":"matte","label":"Matte"}],"default":"gloss"}}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('prod_004', 'postcards', 'Postcards', 'Beautiful postcards for direct mail campaigns, thank you notes, or event invitations.', 30.00, 'https://images.unsplash.com/photo-1516724562728-afc824a36e84?w=400', 'pcat_002', true, 'DIRECT_ONLY', '{"size":{"label":"Size","options":[{"value":"standard","label":"Standard (4x6 in)"},{"value":"large","label":"Large (5x7 in)"}],"default":"standard"},"paperWeight":{"label":"Paper Weight","options":[{"value":"300gsm","label":"300gsm"},{"value":"400gsm","label":"400gsm (Premium)"}],"default":"300gsm"},"finish":{"label":"Finish","options":[{"value":"matte","label":"Matte"},{"value":"gloss","label":"Gloss UV"}],"default":"matte"}}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('prod_005', 'letterheads', 'Letterheads', 'Professional letterhead printing to elevate your business correspondence.', 35.00, 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400', 'pcat_001', true, 'DIRECT_ONLY', '{"paperType":{"label":"Paper Type","options":[{"value":"bond","label":"Bond (80gsm)"},{"value":"premium","label":"Premium (100gsm)"},{"value":"linen","label":"Linen Textured"}],"default":"bond"},"printType":{"label":"Print Type","options":[{"value":"digital","label":"Digital"},{"value":"offset","label":"Offset (Premium)"}],"default":"digital"}}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('prod_006', 'envelopes', 'Custom Envelopes', 'Branded envelopes to complete your professional stationery suite.', 40.00, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?w=400', 'pcat_001', true, 'DIRECT_ONLY', '{"size":{"label":"Size","options":[{"value":"dl","label":"DL (110x220mm)"},{"value":"c5","label":"C5 (162x229mm)"},{"value":"c4","label":"C4 (229x324mm)"}],"default":"dl"},"printArea":{"label":"Print Area","options":[{"value":"front","label":"Front Only"},{"value":"front-back","label":"Front & Back"},{"value":"full","label":"Full Wrap"}],"default":"front"}}', '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Insert product variants (tiered pricing)
INSERT INTO product_variants (id, product_id, label, quantity, unit_price, total_price, compare_at_price, discount_label, sort_order, is_active, created_at, updated_at) VALUES
-- Business Cards variants
('pvar_001', 'prod_001', '50 Business Cards', 50, 0.35, 17.50, NULL, NULL, 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_002', 'prod_001', '100 Business Cards', 100, 0.25, 25.00, 35.00, '29% off', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_003', 'prod_001', '150 Business Cards', 150, 0.18, 27.00, 52.50, '49% off', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_004', 'prod_001', '200 Business Cards', 200, 0.17, 34.00, 70.00, '51% off', 4, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_005', 'prod_001', '500 Business Cards', 500, 0.12, 60.00, 175.00, '66% off', 5, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
-- Flyers variants
('pvar_006', 'prod_002', '50 Flyers', 50, 0.50, 25.00, NULL, NULL, 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_007', 'prod_002', '100 Flyers', 100, 0.40, 40.00, 50.00, '20% off', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_008', 'prod_002', '250 Flyers', 250, 0.30, 75.00, 125.00, '40% off', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_009', 'prod_002', '500 Flyers', 500, 0.22, 110.00, 250.00, '56% off', 4, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
-- Stickers variants
('pvar_010', 'prod_003', '25 Stickers', 25, 0.60, 15.00, NULL, NULL, 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_011', 'prod_003', '50 Stickers', 50, 0.50, 25.00, 30.00, '17% off', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_012', 'prod_003', '100 Stickers', 100, 0.40, 40.00, 60.00, '33% off', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_013', 'prod_003', '250 Stickers', 250, 0.28, 70.00, 150.00, '53% off', 4, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
-- Postcards variants
('pvar_014', 'prod_004', '50 Postcards', 50, 0.60, 30.00, NULL, NULL, 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_015', 'prod_004', '100 Postcards', 100, 0.45, 45.00, 60.00, '25% off', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_016', 'prod_004', '250 Postcards', 250, 0.32, 80.00, 150.00, '47% off', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
-- Letterheads variants
('pvar_017', 'prod_005', '100 Letterheads', 100, 0.35, 35.00, NULL, NULL, 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_018', 'prod_005', '250 Letterheads', 250, 0.28, 70.00, 87.50, '20% off', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_019', 'prod_005', '500 Letterheads', 500, 0.22, 110.00, 175.00, '37% off', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
-- Envelopes variants
('pvar_020', 'prod_006', '100 Envelopes', 100, 0.40, 40.00, NULL, NULL, 1, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_021', 'prod_006', '250 Envelopes', 250, 0.32, 80.00, 100.00, '20% off', 2, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('pvar_022', 'prod_006', '500 Envelopes', 500, 0.24, 120.00, 200.00, '40% off', 3, true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');

-- Design uploads table (for customer-uploaded designs in product configurator)
CREATE TABLE IF NOT EXISTS design_uploads (
    id TEXT PRIMARY KEY,
    cart_item_id TEXT REFERENCES cart_items(id) ON DELETE SET NULL,
    order_item_id TEXT REFERENCES order_items(id) ON DELETE SET NULL,
    product_id TEXT NOT NULL REFERENCES products(id),
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'pdf',
    original_filename TEXT NOT NULL,
    num_pages INTEGER NOT NULL DEFAULT 1,
    preview_images TEXT,  -- JSON array of preview image URLs
    meta TEXT,            -- JSON metadata (dpi, dimensions, warnings)
    session_id TEXT,      -- For guest users before cart
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Print sides configuration table (defines which sides each product has)
CREATE TABLE IF NOT EXISTS product_print_config (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) UNIQUE,
    sides TEXT NOT NULL DEFAULT '[{"key":"front","label":"Front","required":true},{"key":"back","label":"Back","required":false}]',
    requires_design_upload BOOLEAN NOT NULL DEFAULT false,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Insert product images
INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order, is_primary, created_at) VALUES
('pimg_001', 'prod_001', 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800', 'Business cards stack', 1, true, '2024-01-01T08:00:00Z'),
('pimg_002', 'prod_001', 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800', 'Business card close-up', 2, false, '2024-01-01T08:00:00Z'),
('pimg_003', 'prod_002', 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800', 'Colorful flyers', 1, true, '2024-01-01T08:00:00Z'),
('pimg_004', 'prod_003', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', 'Custom stickers', 1, true, '2024-01-01T08:00:00Z'),
('pimg_005', 'prod_004', 'https://images.unsplash.com/photo-1516724562728-afc824a36e84?w=800', 'Postcards collection', 1, true, '2024-01-01T08:00:00Z'),
('pimg_006', 'prod_005', 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800', 'Professional letterhead', 1, true, '2024-01-01T08:00:00Z'),
('pimg_007', 'prod_006', 'https://images.unsplash.com/photo-1579751626657-72bc17010498?w=800', 'Custom envelopes', 1, true, '2024-01-01T08:00:00Z');

-- Insert print configurations for products
INSERT INTO product_print_config (id, product_id, sides, requires_design_upload, created_at, updated_at) VALUES
('ppc_001', 'prod_001', '[{"key":"front","label":"Front","required":true},{"key":"back","label":"Back","required":false}]', true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('ppc_002', 'prod_002', '[{"key":"front","label":"Front","required":true},{"key":"back","label":"Back","required":false}]', true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('ppc_003', 'prod_003', '[{"key":"front","label":"Front","required":true}]', true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('ppc_004', 'prod_004', '[{"key":"front","label":"Front","required":true},{"key":"back","label":"Back","required":false}]', true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('ppc_005', 'prod_005', '[{"key":"front","label":"Front","required":true}]', true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z'),
('ppc_006', 'prod_006', '[{"key":"front","label":"Front","required":true},{"key":"back","label":"Back (Flap)","required":false}]', true, '2024-01-01T08:00:00Z', '2024-01-01T08:00:00Z');