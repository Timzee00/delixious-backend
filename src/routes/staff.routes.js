import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { staffInviteSchema, acceptStaffInviteSchema, staffUpdateSchema, staffOrderStatusSchema, staffListQuerySchema, staffItemAvailabilitySchema } from '../schemas/staff.schema.js';
import {
  listRestaurantTeam, createTeamInvite, acceptTeamInvite, updateTeamMember,
  listMyStaffMemberships, listStaffOrders, changeStaffOrderStatus,
  listStaffMenu, updateStaffItemAvailability,
} from '../controllers/staff.controller.js';

const router = Router();
const inviteLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many invitations or attempts. Please wait.' },
});
router.get('/mine', requireAuth, listMyStaffMemberships);
router.post('/accept', inviteLimit, requireAuth, validate({ body: acceptStaffInviteSchema }), acceptTeamInvite);
router.get('/restaurants/:restaurantId/team', requireAuth, listRestaurantTeam);
router.post('/restaurants/:restaurantId/invites', inviteLimit, requireAuth, validate({ body: staffInviteSchema }), createTeamInvite);
router.patch('/restaurants/:restaurantId/members/:userId', requireAuth, validate({ body: staffUpdateSchema }), updateTeamMember);
router.get('/restaurants/:restaurantId/menu', requireAuth, listStaffMenu);
router.patch('/restaurants/:restaurantId/menu/:itemId/availability', requireAuth, validate({ body: staffItemAvailabilitySchema }), updateStaffItemAvailability);
router.get('/restaurants/:restaurantId/orders', requireAuth, validate({ query: staffListQuerySchema }), listStaffOrders);
router.patch('/orders/:orderId/status', requireAuth, validate({ body: staffOrderStatusSchema }), changeStaffOrderStatus);
export default router;
