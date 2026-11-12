# Chandu Chicken Center — RESTful API Documentation

This document describes all endpoints in the Chandu Chicken Center modular Express & TypeScript backend.

---

## 1. General Architecture & Headers

- **Base URL:** `/api`
- **Content-Type:** `application/json`
- **Protected Endpoints:** Pass the admin session bearer token:
  ```http
  Authorization: Bearer <token>
  ```

---

## 2. Public Customer Endpoints

### 2.1 Get Products
- **Endpoint:** `GET /api/products`
- **Query Parameters:**
  - `category` *(optional)*: Filter by Category ID
  - `search` *(optional)*: Case-insensitive search across name, description, category
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "products": [
      {
        "id": "prod-curry-cut",
        "name": "Fresh Chicken Curry Cut (Skinless)",
        "slug": "fresh-chicken-curry-cut-skinless",
        "categoryId": "cat-fresh-cuts",
        "categoryName": "Fresh Chicken Cuts",
        "description": "Tender bone-in pieces cleaned with RO water.",
        "imageUrl": "https://...",
        "weights": [
          { "weight": "250g", "price": 65, "inStock": true },
          { "weight": "500g", "price": 125, "inStock": true },
          { "weight": "1kg", "price": 240, "inStock": true }
        ],
        "cutOptions": ["Standard Curry Cut", "Small Bites", "Skin-On"],
        "isAvailable": true,
        "isFeatured": true,
        "badge": "Bestseller",
        "netWeightDescription": "Cleaned net weight"
      }
    ]
  }
  ```

### 2.2 Get Single Product
- **Endpoint:** `GET /api/products/:id`
- **Response `200 OK`:** Returns `{ "success": true, "product": { ... } }`
- **Response `404 Not Found`:** If product does not exist.

### 2.3 Get Categories
- **Endpoint:** `GET /api/categories`
- **Response `200 OK`:** Returns array of sorted categories with `id`, `name`, `slug`, `imageUrl`, `displayOrder`.

### 2.4 Get Shop Settings
- **Endpoint:** `GET /api/settings`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "settings": {
      "shopName": "Chandu Chicken Center",
      "tagline": "100% Farm Fresh Tender Chicken Delivered in 45 Mins",
      "shopPhone": "+91 98480 22338",
      "shopWhatsApp": "+91 98480 22338",
      "address": "Shop No. 4, Main Road, Market Junction",
      "landmark": "Opposite Rythu Bazar",
      "city": "Hyderabad / Vijayawada",
      "isOpen": true,
      "openTime": "07:00 AM",
      "closeTime": "09:00 PM",
      "deliveryFee": 30,
      "freeDeliveryThreshold": 499,
      "minOrderAmount": 150,
      "deliveryTimeEstimateMins": 45
    }
  }
  ```

---

## 3. Order Management & Guest Checkout

### 3.1 Place Guest Order
- **Production endpoint:** Supabase Edge Function `create-guest-order`.
- **Local Express fallback:** `POST /api/orders` (only when Supabase is not configured).
- **Authentication:** None required for guest checkout; no account, password, or OTP needed.
- **Payment:** COD only until a real UPI provider is configured and verified.
- **Request Body:**
  ```json
  {
    "customer": {
      "name": "Ramesh Varma",
      "phone": "9848012345",
      "address": "Flat 302, Sri Sai Residency, Street No. 3",
      "landmark": "Behind Rythu Bazar",
      "notes": "Small pieces with less bone please"
    },
    "items": [
      {
        "productId": "prod-curry-cut",
        "weight": "1kg",
        "cutPreference": "Standard Curry Cut (12-16 pcs/kg)",
        "quantity": 1
      }
    ],
    "paymentMethod": "COD",
    "idempotencyKey": "idem-1772635432-8492"
  }
  ```
- **Server Validations:**
  - Verifies shop is open (`settings.isOpen`).
  - Validates customer name (>= 2 chars) and 10-digit Indian mobile number.
  - Looks up current product weight prices directly from the database (client-submitted prices are ignored and recalculated).
  - Computes delivery fee (free if subtotal >= `freeDeliveryThreshold`, else `deliveryFee`).
  - Verifies minimum order value.
  - Saves an immutable snapshot of unit price, weight, cut, and quantity.
  - Handles duplicate requests via `idempotencyKey`.
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "message": "Order placed successfully! Fresh chicken is being prepared for you.",
    "order": {
      "id": "ord-1772635432-1049",
      "orderNumber": "CCC-20261020-1049",
      "customer": { ... },
      "items": [ ... ],
      "subtotal": 240,
      "deliveryFee": 30,
      "totalAmount": 270,
      "paymentMethod": "COD",
      "paymentStatus": "Pending",
      "orderStatus": "New",
      "statusHistory": [
        { "status": "New", "timestamp": "2026-10-20T...", "note": "Order placed via online shop" }
      ],
      "estimatedDeliveryTime": "45 mins"
    }
  }
  ```

### 3.2 Order Tracking Status
- **Production endpoint:** Supabase Edge Function `track-order`, using the high-entropy tracking token returned after checkout.
- **Legacy Express endpoint:** `GET /api/orders/:orderNumberOrId` is disabled because an order number alone must not reveal customer details.
- **Legacy phone-only history lookup:** Disabled; a phone number alone is not sufficient proof of identity.
- **Response:** The production tracking function returns only the public order status timeline and estimated delivery time, not customer contact details or the full order record.

---

## 4. Protected Admin Endpoints

### 4.1 Admin Login
- **Production authentication:** Supabase Authentication email/password sign-in, followed by authorization against the trusted `public.admin_users` table.
- **Local Express fallback:** `POST /api/admin/login` only works when a local administrator record has been explicitly provisioned. There is no shared/default admin account.
- **Password recovery:** Requires a valid Supabase Authentication recovery flow; the local fallback does not implement email recovery.

### 4.2 Get All Orders (Filtered)
- **Endpoint:** `GET /api/admin/orders`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:** `status`, `paymentStatus`, `search`

### 4.3 Update Order Status
- **Endpoint:** `PATCH /api/admin/orders/:id/status`
- **Body:** `{ "status": "Preparing", "note": "Carving in progress" }`
- **Valid Statuses:**
  - `New`
  - `Accepted`
  - `Preparing`
  - `Ready for Dispatch`
  - `Out for Delivery`
  - `Delivered`
  - `Rejected`
  - `Cancelled`

### 4.4 Update Payment Status (Separated)
- **Endpoint:** `PATCH /api/admin/orders/:id/payment`
- **Body:** `{ "paymentStatus": "Paid" }`
- **Valid Statuses:** `Pending`, `Paid`, `Failed`, `Refunded`
- *Note:* Delivered orders do not automatically mark payment as paid until cash is received and reconciled.

### 4.5 Product & Stock Controls
- `POST /api/admin/products` — Create product
- `PUT /api/admin/products/:id` — Update product details and weight variants
- `DELETE /api/admin/products/:id` — Delete product
- `PATCH /api/admin/products/:id/stock` — Fast toggle `isAvailable`
- `PATCH /api/admin/products/:id/weight-stock` — Fast toggle variant stock (250g, 500g, 1kg)

### 4.6 Product Image Upload
- **Endpoint:** `POST /api/admin/upload-image`
- **Body:** `{ "imageBase64": "...", "mimeType": "image/jpeg", "filename": "curry-cut.jpg" }`
- Validates file MIME types (`image/jpeg`, `image/png`, `image/webp`) and enforces max 5MB limit.

### 4.7 Reports & Performance
- **Endpoint:** `GET /api/admin/reports`
- Returns today's revenue, active deliveries, queue counts, status distribution, and top 5 revenue-generating cuts.
