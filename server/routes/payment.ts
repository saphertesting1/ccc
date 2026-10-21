import { Router, Request, Response } from 'express';
import { getPaymentProvider } from '../services/paymentProvider.js';

const router = Router();

// POST /api/payment/session
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { orderId, amountInPaise, customerPhone, customerName, idempotencyKey } = req.body;
    const provider = getPaymentProvider();

    const session = await provider.createPaymentSession({
      orderId,
      orderNumber: `CCC-${orderId}`,
      amountInPaise: amountInPaise || 0,
      customerPhone: customerPhone || '',
      customerName: customerName || '',
      idempotencyKey: idempotencyKey || `idem-${Date.now()}`
    });

    res.json({
      success: true,
      pendingIntegration: true,
      session,
      notice: 'UPI payment gateway integration is pending bank merchant account provisioning. Real payments are not currently processed through UPI.'
    });
  } catch (error) {
    console.error('Payment session error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate payment session' });
  }
});

// GET /api/payment/status/:orderId
router.get('/status/:orderId', async (req: Request, res: Response) => {
  try {
    const provider = getPaymentProvider();
    const status = await provider.getPaymentStatus(req.params.orderId, req.query.txId as string || '');
    res.json({ success: true, status });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ success: false, error: 'Failed to check payment status' });
  }
});

export default router;
