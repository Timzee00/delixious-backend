import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  checkout,
  listMyOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/orders.controller.js';
import { checkoutSchema, updateOrderStatusSchema, listOrdersQuerySchema } from '../schemas/orders.schema.js';

const router = Router();

router.post('/checkout', requireAuth, validate({ body: checkoutSchema }), checkout);
router.get('/', requireAuth, validate({ query: listOrdersQuerySchema }), listMyOrders);
router.get('/:id', requireAuth, getOrder);
router.patch('/:id/status', requireAuth, validate({ body: updateOrderStatusSchema }), updateOrderStatus);
router.patch('/:id/cancel', requireAuth, cancelOrder);

export default router;
