import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  checkout,
  listMyOrders,
  getOrderGroup,
  getOrder,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/orders.controller.js';
import { checkoutSchema, updateOrderStatusSchema, listOrdersQuerySchema } from '../schemas/orders.schema.js';
import { previewReorder, applyReorder } from '../controllers/reorder.controller.js';
import { z } from 'zod';

const router = Router();

router.post('/checkout', requireAuth, validate({ body: checkoutSchema }), checkout);
router.get('/', requireAuth, validate({ query: listOrdersQuerySchema }), listMyOrders);
router.get('/group/:checkoutGroupId', requireAuth, getOrderGroup);
router.get('/:id/reorder-preview', requireAuth, previewReorder);
router.post('/:id/reorder', requireAuth, validate({ body: z.object({ confirm_replace: z.literal(true) }).strict() }), applyReorder);
router.get('/:id', requireAuth, getOrder);
router.patch('/:id/status', requireAuth, validate({ body: updateOrderStatusSchema }), updateOrderStatus);
router.patch('/:id/cancel', requireAuth, cancelOrder);

export default router;
