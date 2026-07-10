import app from './app.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

// ---------- Process-level monitoring ----------
// A crashed process serving no requests is worse than a logged error, so
// uncaught exceptions log with full context and then exit (let your process
// manager - Render, pm2, systemd - restart cleanly). Unhandled rejections are
// logged but don't crash the process, since a single missed .catch()
// elsewhere shouldn't take the whole API down.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception - shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : reason });
});

app.listen(PORT, () => {
  logger.info(`Delixious API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
