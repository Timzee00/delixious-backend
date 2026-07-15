import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  signup,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  submitRiderBankDetails,
} from '../controllers/auth.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema, updateProfileSchema } from '../schemas/auth.schema.js';
import { bankDetailsSchema } from '../schemas/payout.schema.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/signup', authLimiter, validate({ body: signupSchema }), signup);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, validate({ body: updateProfileSchema }), updateProfile);
router.post(
  '/rider/bank-details',
  requireAuth,
  requireRole('delivery_agent'),
  validate({ body: bankDetailsSchema }),
  submitRiderBankDetails
);

export default router;
