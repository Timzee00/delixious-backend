import { Router } from 'express';
import { submitBankDetails } from '../controllers/restaurants.controller.js';
import { bankDetailsSchema } from '../schemas/payout.schema.js';
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
import { listRestaurantOrders } from '../controllers/orders.controller.js';
import { getRestaurantReviews } from '../controllers/reviews.controller.js';
import { createRestaurantSchema, updateRestaurantSchema, listRestaurantsQuerySchema } from '../schemas/restaurants.schema.js';
import { createMenuItemSchema } from '../schemas/menu.schema.js';
import { listOrdersQuerySchema } from '../schemas/orders.schema.js';
import { listReviewsQuerySchema } from '../schemas/reviews.schema.js';

const router = Router();

// ---------- Public ----------
router.get('/', validate({ query: listRestaurantsQuerySchema }), listRestaurants);
// NOTE: /mine must be registered before /:id or Express will treat "mine" as an id
router.get('/mine', requireAuth, requireRole('restaurant_owner', 'admin'), getMyRestaurants);
router.get('/:id', getRestaurant);
router.get('/:id/menu', getRestaurantMenu);
router.get('/:id/reviews', validate({ query: listReviewsQuerySchema }), getRestaurantReviews);

// ---------- Restaurant owner only ----------
router.post('/', requireAuth, requireRole('restaurant_owner', 'admin'), validate({ body: createRestaurantSchema }), createRestaurant);
router.put('/:id', requireAuth, requireRestaurantOwnership, validate({ body: updateRestaurantSchema }), updateRestaurant);
router.patch('/:id/toggle-open', requireAuth, requireRestaurantOwnership, toggleOpen);
router.post(
  '/:id/bank-details',
  requireAuth,
  requireRestaurantOwnership,
  validate({ body: bankDetailsSchema }),
  submitBankDetails
);
router.delete('/:id', requireAuth, requireRestaurantOwnership, deleteRestaurant);
router.post(
  '/:id/menu',
  requireAuth,
  requireRestaurantOwnership,
  validate({ body: createMenuItemSchema }),
  createMenuItem
);
router.get(
  '/:id/orders',
  requireAuth,
  requireRestaurantOwnership,
  validate({ query: listOrdersQuerySchema }),
  listRestaurantOrders
);

export default router;
