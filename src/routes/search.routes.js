import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { search } from '../controllers/search.controller.js';
import { searchQuerySchema } from '../schemas/search.schema.js';

const router = Router();

router.get('/', validate({ query: searchQuerySchema }), search);

export default router;
