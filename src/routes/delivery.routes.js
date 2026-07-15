import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  assignAgent,
  updateLocation,
  updateDeliveryStatus,
  getDeliveryTracking,
  listMyDeliveries,
  listMyDeliveryHistory,
  listAvailableDeliveries,
  claimDelivery,
  searchDeliveryAgents,
} from '../controllers/delivery.controller.js';
import {
  assignAgentSchema,
  updateLocationSchema,
  updateDeliveryStatusSchema,
  searchAgentsQuerySchema,
} from '../schemas/delivery.schema.js';

const router = Router();

// NOTE: fixed paths must be registered before /:orderId or Express would
// treat them as an orderId.
router.get('/my-deliveries', requireAuth, requireRole('delivery_agent', 'admin'), listMyDeliveries);
router.get('/my-deliveries/history', requireAuth, requireRole('delivery_agent', 'admin'), listMyDeliveryHistory);
router.get('/available', requireAuth, requireRole('delivery_agent', 'admin'), listAvailableDeliveries);
router.get(
  '/agents/search',
  requireAuth,
  requireRole('restaurant_owner', 'admin'),
  validate({ query: searchAgentsQuerySchema }),
  searchDeliveryAgents
);
router.get('/:orderId', requireAuth, getDeliveryTracking);
router.patch('/:orderId/assign-agent', requireAuth, validate({ body: assignAgentSchema }), assignAgent);
router.patch('/:orderId/claim', requireAuth, requireRole('delivery_agent'), claimDelivery);
router.patch('/:orderId/location', requireAuth, validate({ body: updateLocationSchema }), updateLocation);
router.patch('/:orderId/status', requireAuth, validate({ body: updateDeliveryStatusSchema }), updateDeliveryStatus);

export default router;
