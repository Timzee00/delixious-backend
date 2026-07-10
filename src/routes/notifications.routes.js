import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notifications.controller.js';
import { listNotificationsQuerySchema } from '../schemas/notifications.schema.js';

const router = Router();

router.get('/', requireAuth, validate({ query: listNotificationsQuerySchema }), listNotifications);
router.get('/unread-count', requireAuth, getUnreadCount);
router.patch('/read-all', requireAuth, markAllAsRead);
router.patch('/:id/read', requireAuth, markAsRead);
router.delete('/:id', requireAuth, deleteNotification);

export default router;
