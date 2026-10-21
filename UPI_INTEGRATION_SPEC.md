# Chandu Chicken Center — UPI Payment Architecture & Integration Specification

## 1. Current Phase Status

In the current production build:
- **Cash on Delivery (COD)** is implemented end-to-end as the active payment method.
- **UPI** is visibly presented in the checkout interface with an explicit **“UPI integration pending”** banner and explanatory modal.
- No dummy UPI merchant IDs, fake simulations, or premature order approvals are permitted.

---

## 2. Architectural Design & IPaymentProvider Interface

The backend architecture is pre-wired with an interchangeable provider interface in `server/services/paymentProvider.ts`:

```typescript
export interface IPaymentProvider {
  readonly providerName: string;
  createPaymentSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResponse>;
  getPaymentStatus(orderId: string, transactionId: string): Promise<PaymentStatusResponse>;
  verifyWebhook(headers: Record<string, string>, payload: any): Promise<WebhookVerificationResult>;
}
```

### Critical Security Principles:
1. **Never Trust Client Redirects:** An order is NEVER confirmed merely because a customer returns from a UPI app (Google Pay, PhonePe, Paytm). The client can be closed, spoofed, or manipulated.
2. **Authoritative Server Verification:** Confirmation occurs only after:
   - A cryptographically signed webhook callback is received and verified by the backend, OR
   - The backend queries the provider's server-to-server Order Status API directly.
3. **No PIN / Credential Storage:** The shop database never stores bank details or UPI PINs. Only transaction identifiers and audit status are retained.

---

## 3. Database Schema Migration Needed for UPI Activation

The relational schema (`server/db/schema.sql`) already includes the dedicated `payment_transactions` audit table:

```sql
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_provider VARCHAR(50) NOT NULL, -- 'phonepe', 'razorpay', 'cashfree'
    provider_transaction_id VARCHAR(100),
    idempotency_token VARCHAR(100) UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(5) DEFAULT 'INR',
    status VARCHAR(30) NOT NULL, -- 'initiated', 'pending', 'success', 'failed', 'timed_out'
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

When enabling UPI, run migration `migrations/002_enable_upi_webhook_indexing.sql`:
```sql
CREATE INDEX IF NOT EXISTS idx_payment_tx_provider_id ON payment_transactions(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON payment_transactions(status);
```

---

## 4. Required Backend Routes for Active Phase

When commercial bank merchant credentials (e.g., PhonePe Merchant ID & Salt Key, or Razorpay Key & Secret) are configured in `.env`, the following endpoints in `server/routes/payment.ts` are activated:

1. `POST /api/payment/create-order`
   - Accepts order ID and calculates amount in paise on the server.
   - Calls provider API to create a payment link or UPI Intent (`upi://pay?pa=...`).
   - Returns intent URL for Android apps (deep links to GPay/PhonePe).

2. `POST /api/payment/webhook`
   - Receives server-to-server notifications from the payment gateway.
   - Verifies HMAC-SHA256 signature against `PAYMENT_WEBHOOK_SECRET`.
   - On verified `PAYMENT_SUCCESS`, atomically updates order `paymentStatus = 'Paid'` and adds an audit record.

3. `GET /api/payment/verify/:orderId`
   - Polled by the frontend order status screen while awaiting webhook confirmation.
   - Queries gateway status endpoint directly to resolve any network timeouts.

---

## 5. Duplicate Payment Prevention

- **Idempotency Tokens:** Each payment request generates a unique idempotency key tied to `order_id` + retry attempt.
- **Distributed Lock / Atomic Transaction:** Database transaction locks the order row during status transitions to prevent concurrent double-crediting.
