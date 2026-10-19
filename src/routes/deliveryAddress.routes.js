import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { deliveryAddressSchema } from '../schemas/deliveryAddress.schema.js';
import { z } from 'zod';
import { listDeliveryAddresses,createDeliveryAddress,removeDeliveryAddress,setDefaultDeliveryAddress } from '../controllers/deliveryAddress.controller.js';

const router=Router();
router.use(requireAuth);
router.get('/',listDeliveryAddresses);
router.post('/',validate({body:deliveryAddressSchema}),createDeliveryAddress);
router.patch('/:id/default',validate({params:z.object({id:z.string().uuid()})}),setDefaultDeliveryAddress);
router.delete('/:id',validate({params:z.object({id:z.string().uuid()})}),removeDeliveryAddress);
export default router;
