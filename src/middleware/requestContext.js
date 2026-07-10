import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * Assigns a unique ID to every request (returned as X-Request-Id, and
 * included in every log line for that request) and logs how long it took.
 * This is the practical "monitoring" story for a self-hosted API without a
 * paid APM: structured, greppable logs that a tool like Datadog/CloudWatch
 * can ingest later without any code changes.
 */
export function requestContext(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, {
      requestId: req.id,
      durationMs: Math.round(durationMs),
    });
  });

  next();
}
