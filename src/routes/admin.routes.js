import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  approvalStatusSchema,
  suspendUserSchema,
  listRestaurantsAdminQuerySchema,
  listUsersAdminQuerySchema,
  listQuerySchema,
  broadcastSchema,
} from '../schemas/admin.schema.js';
import {
  getStats,
  listRestaurantsAdmin,
  setRestaurantApproval,
  listRidersAdmin,
  setRiderApproval,
  listUsersAdmin,
  setUserSuspension,
  listOrdersAdmin,
  sendBroadcast,
} from '../controllers/admin.controller.js';

const router = Router();

// Every route below requires a logged-in admin.
router.use(requireAuth, requireRole('admin'));

router.get('/stats', getStats);

router.get('/restaurants', validate({ query: listRestaurantsAdminQuerySchema }), listRestaurantsAdmin);
router.patch('/restaurants/:id/approval', validate({ body: approvalStatusSchema }), setRestaurantApproval);

router.get('/riders', validate({ query: listQuerySchema }), listRidersAdmin);
router.patch('/riders/:id/approval', validate({ body: approvalStatusSchema }), setRiderApproval);

router.get('/users', validate({ query: listUsersAdminQuerySchema }), listUsersAdmin);
router.patch('/users/:id/suspend', validate({ body: suspendUserSchema }), setUserSuspension);

router.get('/orders', validate({ query: listQuerySchema }), listOrdersAdmin);

router.post('/broadcast', validate({ body: broadcastSchema }), sendBroadcast);

export default router;
