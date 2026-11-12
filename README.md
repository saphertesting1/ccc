# Chandu Chicken Center — Online Poultry Ordering & Shop Management Platform

A production-oriented commercial ordering platform and mobile application built for **Chandu Chicken Center**, an authentic chicken shop in India.

This project delivers a **single unified codebase** serving:
1. **A responsive customer web app** with instant guest checkout, dynamic weight options (250g, 500g, 1kg), and live order status tracking.
2. **An Android native app** packaged with Capacitor sharing 100% of the UI, business logic, and API layer.
3. **An admin management portal** accessible from both website and Android app with order dispatch workflows, stock management, and sales reports.

---

## 🎨 Brand Identity

- **Primary Red:** `#D92332`
- **Dark Brown:** `#38251F`
- **Warm Cream:** `#FFF9F1`
- **Success Green:** Verified Halal & delivered states
- **Typography:** Outfit & Plus Jakarta Sans

---

## 🚀 Key Features

### For Customers (Guest Experience)
- **Zero-Friction Guest Checkout:** No account creation, passwords, or OTPs required.
- **Dynamic Weight & Butchering Styles:** Select 250g, 500g, or 1kg with live price updates. Choose custom butcher cuts (Standard Curry Cut, Biryani Cut, Small Bites, Skin-On).
- **Home Delivery in ~45 Mins:** Fast dispatch from the nearest butchery hub.
- **Verified Payment Handling:**
  - **Cash on Delivery (COD):** Fully functional end-to-end.
  - **UPI:** Clearly badged with an informative "UPI integration pending" notice (no fake simulations or unverified confirmations).
- **Live Order Status Tracking:** Track orders with reference numbers (e.g. `CCC-20261020-001`) through all 6 butchering stages.

### For Shop Managers (Admin Portal)
- **Prominent Admin Entry:** Admin Login button visible in public header, footer, and mobile drawer.
- **Live Butchering Feed:** Real-time queue of incoming orders with 1-click status advancement (`Accept` → `Start Prep` → `Dispatch` → `Deliver`).
- **Separate Payment Tracking:** Delivered orders remain `Pending` until cash is reconciled at the counter.
- **Stock & Variant Management:** Toggle full-product availability or specific pack weights (e.g. out of 250g packs).
- **Image Upload Service:** Upload and replace cuts photography with MIME type & 5MB size validation.
- **Store Master Switch:** One-click store open/closed toggle.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript, Vite, React Router 7, Tailwind CSS v4, Lucide Icons, Canvas Confetti
- **Mobile Packaging:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`)
- **Backend:** Node.js, Express, TypeScript (`tsx`)
- **Database:** PostgreSQL (with interchangeable repository layer & zero-config local file persistence fallback)
- **Storage:** Pluggable image storage service (Local disk, AWS S3, Cloudinary)

---

## ⚡ Quick Start & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Full-Stack Development Server
```bash
npm run dev
```
The server will start at `http://localhost:3000` with the Express API and Vite React frontend running together.

### 3. Administrator Authentication
- Production administrator sign-in is handled by Supabase Authentication.
- Only users authorized in the trusted `public.admin_users` table can access the admin portal.
- No shared/default administrator username or password is provided.
- Local Express fallback mode does not create a default admin account or provide password recovery.

### 4. Run Automated Tests
```bash
npm test
```
Executes the comprehensive automated test suite in `tests/shop.test.ts`.

---

## 📱 Android App Packaging

Refer to [`ANDROID_BUILD_GUIDE.md`](./ANDROID_BUILD_GUIDE.md) for complete instructions on building the Android APK, generating release signing keys, and publishing to Google Play Store.

```bash
npm run build
npx cap sync android
npx cap open android
```

---

## 📚 Detailed Documentation

- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md): Full REST API endpoints, schemas, and payload examples.
- [`UPI_INTEGRATION_SPEC.md`](./UPI_INTEGRATION_SPEC.md): Technical specification for future PhonePe/Razorpay UPI integration.
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md): Commercial deployment instructions for Cloud Run, PostgreSQL, and AWS S3.
- [`server/db/schema.sql`](./server/db/schema.sql): Complete PostgreSQL relational DDL with indexes and audit tables.
