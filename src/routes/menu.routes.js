import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireMenuItemOwnership } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import { listMenuFeed, updateMenuItem, toggleAvailability, deleteMenuItem } from '../controllers/menu.controller.js';
import { updateMenuItemSchema } from '../schemas/menu.schema.js';
import { menuFeedQuerySchema } from '../schemas/menu-feed.schema.js';

const router = Router();

router.get('/feed', validate({ query: menuFeedQuerySchema }), listMenuFeed);
router.put('/:id', requireAuth, requireMenuItemOwnership, validate({ body: updateMenuItemSchema }), updateMenuItem);
router.patch('/:id/toggle-availability', requireAuth, requireMenuItemOwnership, toggleAvailability);
router.delete('/:id', requireAuth, requireMenuItemOwnership, deleteMenuItem);

export default router;
