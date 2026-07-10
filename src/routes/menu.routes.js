import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireMenuItemOwnership } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import { updateMenuItem, toggleAvailability, deleteMenuItem } from '../controllers/menu.controller.js';
import { updateMenuItemSchema } from '../schemas/menu.schema.js';

const router = Router();

router.put('/:id', requireAuth, requireMenuItemOwnership, validate({ body: updateMenuItemSchema }), updateMenuItem);
router.patch('/:id/toggle-availability', requireAuth, requireMenuItemOwnership, toggleAvailability);
router.delete('/:id', requireAuth, requireMenuItemOwnership, deleteMenuItem);

export default router;
