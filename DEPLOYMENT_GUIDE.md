# Chandu Chicken Center — Commercial Deployment & Production Guide

This guide describes how to deploy the Chandu Chicken Center platform to production environments with high availability, security, and low operating costs.

---

## 1. Hosting Architecture Overview

The application is architected to run either as:
1. **Full-Stack Container (Recommended):** A single Node.js Express process serving both the REST API and the compiled Vite frontend on port 3000 (ideal for Google Cloud Run, Railway, Render, DigitalOcean App Platform, or AWS App Runner).
2. **Decoupled Architecture:** Frontend deployed to Vercel/Cloudflare Pages/Netlify, and backend deployed to a Node.js runtime with CORS enabled.

---

## 2. Relational Database Setup (PostgreSQL)

Chandu Chicken Center uses standard PostgreSQL (v14+).

### Step 2.1: Provision a PostgreSQL Database
Compatible providers:
- **Neon / Supabase / Railway / Render / AWS RDS / DigitalOcean Managed Postgres**

### Step 2.2: Apply Migrations
Run the provided SQL migration on your database:
```bash
psql "$DATABASE_URL" -f server/db/schema.sql
```

### Step 2.3: Set Environment Variable
Set the connection string in your hosting provider's environment settings:
```bash
DATABASE_URL="postgresql://user:password@host:5432/chandu_chicken_db?sslmode=require"
```
*(If `DATABASE_URL` is omitted, the application automatically defaults to the zero-config persistent storage layer in `/data`.)*

---

## 3. Product Image Storage Setup

Choose one of three supported image storage modes via `IMAGE_STORAGE_PROVIDER`:

### Option A: Local Disk (Default)
```bash
IMAGE_STORAGE_PROVIDER="local"
```
Saves images to `/data/uploads` and serves them via `/api/uploads/*`. For Cloud Run or ephemeral containers, attach a persistent volume or choose S3/Cloudinary.

### Option B: AWS S3 or Cloudflare R2
```bash
IMAGE_STORAGE_PROVIDER="s3"
AWS_REGION="ap-south-1"
AWS_S3_BUCKET="chandu-chicken-assets"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
```

### Option C: Cloudinary
```bash
IMAGE_STORAGE_PROVIDER="cloudinary"
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

---

## 4. Production Build & Deployment Commands

### Build Steps:
```bash
# 1. Install dependencies
npm install

# 2. Compile frontend assets
npm run build

# 3. Compile backend TypeScript (if using dist-server) or run via tsx
npx esbuild server.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist-server/server.js --packages=external
```

### Start Production Server:
```bash
node dist-server/server.js
```
The server will bind to `0.0.0.0:${PORT}` (default: 3000) and automatically serve static frontend files from `/dist` while handling API traffic under `/api/*`.

---

## 5. Security & Commercial Readiness Checklist

- [x] **No public admin registration:** Only pre-configured admin accounts can log in.
- [x] **Guest checkout with no forced login:** High conversion rate for fast food orders.
- [x] **Server-side price verification:** Client cart prices are never trusted blindly; prices are calculated against database records.
- [x] **Immutable snapshot:** Order items capture exact price, pack weight, and cutting preference at the time the order was placed.
- [x] **Separate payment status:** Delivered orders are not marked as paid until physical cash is collected.
- [x] **No hardcoded secrets:** All keys are driven by `.env`.
- [x] **HTTPS & Custom Domain:** Enforce SSL via Cloudflare or Cloud Run managed certificates.
