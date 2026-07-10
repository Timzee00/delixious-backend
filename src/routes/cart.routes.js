import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getCart, addItemToCart, updateCartItem, removeCartItem, clearCart } from '../controllers/cart.controller.js';
import { addCartItemSchema, updateCartItemSchema } from '../schemas/cart.schema.js';

const router = Router();

router.get('/', requireAuth, getCart);
router.post('/items', requireAuth, validate({ body: addCartItemSchema }), addItemToCart);
router.put('/items/:menuItemId', requireAuth, validate({ body: updateCartItemSchema }), updateCartItem);
router.delete('/items/:menuItemId', requireAuth, removeCartItem);
router.delete('/', requireAuth, clearCart);

export default router;
