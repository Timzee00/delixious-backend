import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { paystackWebhook, verifyPayment, getBanks } from '../controllers/payments.controller.js';

const router = Router();

// Paystack calls this directly - do NOT put requireAuth on it.
router.post('/webhook', paystackWebhook);

router.get('/verify/:reference', requireAuth, verifyPayment);
router.get('/banks', requireAuth, getBanks);

export default router;
