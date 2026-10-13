import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { jobSchema, jobUpdateSchema, jobApplicationSchema, applicationStatusSchema, careersListQuerySchema } from '../schemas/careers.schema.js';
import {
  listPublicCareers, listOwnerJobs, createOwnerJob, updateOwnerJob,
  submitJobApplication, listJobApplications, updateJobApplication,
} from '../controllers/careers.controller.js';

const router = Router();
const applyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many job applications. Please try again later.' } });
router.get('/restaurants/:restaurantId', validate({ query: careersListQuerySchema }), listPublicCareers);
router.get('/restaurants/:restaurantId/manage', requireAuth, listOwnerJobs);
router.post('/restaurants/:restaurantId/jobs', requireAuth, validate({ body: jobSchema }), createOwnerJob);
router.patch('/restaurants/:restaurantId/jobs/:jobId', requireAuth, validate({ body: jobUpdateSchema }), updateOwnerJob);
router.get('/restaurants/:restaurantId/jobs/:jobId/applications', requireAuth, validate({ query: careersListQuerySchema }), listJobApplications);
router.patch('/restaurants/:restaurantId/jobs/:jobId/applications/:applicationId', requireAuth, validate({ body: applicationStatusSchema }), updateJobApplication);
router.post('/jobs/:jobId/apply', applyLimiter, validate({ body: jobApplicationSchema }), submitJobApplication);
export default router;
