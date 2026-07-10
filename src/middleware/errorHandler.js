export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err.message);

  // Multer (file upload) errors are always client-side mistakes (file too
  // large, wrong field name, disallowed type) - never a 500.
  const isMulterError = err.name === 'MulterError' || err.message === 'Only image files are allowed.';
  const status = isMulterError ? 400 : err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Something went wrong on our end. Please try again.'
      : err.message;

  res.status(status).json({ error: message });
}
