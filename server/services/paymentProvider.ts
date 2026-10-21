/**
 * PAYMENT PROVIDER INTERFACE & FUTURE UPI ARCHITECTURE
 * 
 * Chandu Chicken Center — UPI Integration Architecture Specification
 * Designed for server-side verification with providers like PhonePe, Razorpay, or Cashfree.
 * Real orders are NEVER confirmed based on client redirects.
 */

export interface CreatePaymentSessionParams {
  orderId: string;
  orderNumber: string;
  amountInPaise: number; // e.g. ₹240 = 24000 paise
  customerPhone: string;
  customerName: string;
  idempotencyKey: string;
}

export interface PaymentSessionResponse {
  sessionId: string;
  provider: 'pending_upi' | 'phonepe' | 'razorpay' | 'cashfree';
  upiIntentUrl?: string; // e.g. upi://pay?pa=...
  qrCodeData?: string;
  expiresAt: string;
  status: 'PENDING_INTEGRATION' | 'INITIATED' | 'FAILED';
  message: string;
}

export interface PaymentStatusResponse {
  transactionId: string;
  orderId: string;
  amount: number;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'PENDING_INTEGRATION';
  verifiedAt?: string;
  bankReferenceNumber?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  orderId?: string;
  status?: 'SUCCESS' | 'FAILED';
  providerTransactionId?: string;
  reason?: string;
}

export interface IPaymentProvider {
  readonly providerName: string;

  /**
   * Generates a signed payment intent/session on the backend
   */
  createPaymentSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResponse>;

  /**
   * Queries the bank or provider API directly to verify the authentic payment state
   */
  getPaymentStatus(orderId: string, transactionId: string): Promise<PaymentStatusResponse>;

  /**
   * Cryptographically validates inbound server-to-server webhook callbacks
   */
  verifyWebhook(headers: Record<string, string>, payload: any): Promise<WebhookVerificationResult>;
}

// =========================================================================
// Pending UPI Provider (Default implementation for current Phase)
// Rejects payment execution with explicit pending integration status.
// =========================================================================
export class PendingUpiProvider implements IPaymentProvider {
  readonly providerName = 'pending_upi';

  async createPaymentSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResponse> {
    return {
      sessionId: `pending-upi-${params.orderId}`,
      provider: 'pending_upi',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      status: 'PENDING_INTEGRATION',
      message: 'UPI payment integration is pending commercial bank gateway onboarding. Currently, Chandu Chicken Center only accepts Cash on Delivery (COD).'
    };
  }

  async getPaymentStatus(orderId: string, transactionId: string): Promise<PaymentStatusResponse> {
    return {
      transactionId,
      orderId,
      amount: 0,
      status: 'PENDING_INTEGRATION'
    };
  }

  async verifyWebhook(_headers: Record<string, string>, _payload: any): Promise<WebhookVerificationResult> {
    return {
      isValid: false,
      reason: 'UPI webhooks are pending provider gateway configuration.'
    };
  }
}

// Future adapters (PhonePe, Razorpay, Cashfree) will implement IPaymentProvider:
// export class PhonePeUpiProvider implements IPaymentProvider { ... }
// export class RazorpayUpiProvider implements IPaymentProvider { ... }

export function getPaymentProvider(): IPaymentProvider {
  // Provider name can be switched via PAYMENT_GATEWAY_PROVIDER env var
  const provider = process.env.PAYMENT_GATEWAY_PROVIDER || 'pending_upi';
  switch (provider) {
    case 'pending_upi':
    default:
      return new PendingUpiProvider();
  }
}
