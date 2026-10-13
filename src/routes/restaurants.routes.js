import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitBankDetails, getPayoutBanks } from '../controllers/restaurants.controller.js';
import { restaurantBankDetailsSchema } from '../schemas/payout.schema.js';
import { operatingSettingsSchema } from '../schemas/operatingSettings.schema.js';
import { getOperatingSettings, updateOperatingSettings } from '../controllers/operatingSettings.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireRestaurantOwnership } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import {
  listRestaurants,
  getRestaurant,
  getMyRestaurants,
  createRestaurant,
  updateRestaurant,
  toggleOpen,
  deleteRestaurant,
} from '../controllers/restaurants.controller.js';
import { getRestaurantMenu, createMenuItem } from '../controllers/menu.controller.js';
import { getRestaurantMenuManagement } from '../controllers/menu-management.controller.js';
import { listRestaurantOrders } from '../controllers/orders.controller.js';
import { getRestaurantReviews } from '../controllers/reviews.controller.js';
import { createRestaurantSchema, updateRestaurantSchema, listRestaurantsQuerySchema } from '../schemas/restaurants.schema.js';
import { createMenuItemSchema } from '../schemas/menu.schema.js';
import { listOrdersQuerySchema } from '../schemas/orders.schema.js';
import { listReviewsQuerySchema } from '../schemas/reviews.schema.js';

const router = Router();
const payoutLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many payout setup attempts. Please try again later.' },
});

// ---------- Public ----------
router.get('/', validate({ query: listRestaurantsQuerySchema }), listRestaurants);
router.get('/mine', requireAuth, requireRole('restaurant_owner', 'admin'), getMyRestaurants);
router.get('/banks', requireAuth, requireRole('restaurant_owner', 'admin'), getPayoutBanks);
router.get('/:id', getRestaurant);
router.get('/:id/menu', getRestaurantMenu);
router.get('/:id/reviews', validate({ query: listReviewsQuerySchema }), getRestaurantReviews);

// ---------- Restaurant owner only ----------
router.post('/', requireAuth, requireRole('restaurant_owner', 'admin'), validate({ body: createRestaurantSchema }), createRestaurant);
router.put('/:id', requireAuth, requireRestaurantOwnership, validate({ body: updateRestaurantSchema }), updateRestaurant);
router.patch('/:id/toggle-open', requireAuth, requireRestaurantOwnership, toggleOpen);
router.get('/:id/operating-settings', requireAuth, requireRestaurantOwnership, getOperatingSettings);
router.put('/:id/operating-settings', requireAuth, requireRestaurantOwnership, validate({ body: operatingSettingsSchema }), updateOperatingSettings);
router.post('/:id/bank-details', requireAuth, requireRestaurantOwnership, payoutLimiter, validate({ body: restaurantBankDetailsSchema }), submitBankDetails);
router.delete('/:id', requireAuth, requireRestaurantOwnership, deleteRestaurant);
router.get('/:id/menu-management', requireAuth, requireRestaurantOwnership, getRestaurantMenuManagement);
router.post('/:id/menu', requireAuth, requireRestaurantOwnership, validate({ body: createMenuItemSchema }), createMenuItem);
router.get('/:id/orders', requireAuth, requireRestaurantOwnership, validate({ query: listOrdersQuerySchema }), listRestaurantOrders);

export default router;
