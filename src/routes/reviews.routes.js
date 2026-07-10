import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReview, listMyReviews, updateReview, deleteReview } from '../controllers/reviews.controller.js';
import { createReviewSchema, updateReviewSchema, listReviewsQuerySchema } from '../schemas/reviews.schema.js';

const router = Router();

router.post('/', requireAuth, validate({ body: createReviewSchema }), createReview);
router.get('/mine', requireAuth, validate({ query: listReviewsQuerySchema }), listMyReviews);
router.put('/:id', requireAuth, validate({ body: updateReviewSchema }), updateReview);
router.delete('/:id', requireAuth, deleteReview);

export default router;
