import adminRoutes from './routes/admin.routes.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import restaurantsRoutes from './routes/restaurants.routes.js';
import menuItemsRoutes from './routes/menu.routes.js';
import searchRoutes from './routes/search.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import cartRoutes from './routes/cart.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrf.js';
import { requestContext } from './middleware/requestContext.js';
import logger from './utils/logger.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1);

// ---------- Security & parsing ----------
// CSP disabled: this is a JSON API (no HTML rendering), and it would
// otherwise block Swagger UI's inline scripts at /api/docs. Every other
// helmet protection (X-Frame-Options, X-Content-Type-Options, HSTS, etc)
// stays on.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    // '*' is invalid alongside credentials: true (browsers reject it), so
    // fall back to a concrete origin rather than a wildcard.
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(cookieParser());
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(requestContext);
app.use(csrfProtection);

// ---------- Rate limiting ----------
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});
app.use('/api', limiter);

// ---------- Health check (for Render/uptime monitors) ----------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------- API documentation ----------
const openapiDocument = JSON.parse(fs.readFileSync(path.join(__dirname, '../openapi.json'), 'utf-8'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// ---------- Routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/menu-items', menuItemsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/notifications', notificationsRoutes);

// ---------- 404 + error handling ----------
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
