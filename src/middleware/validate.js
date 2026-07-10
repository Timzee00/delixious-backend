/**
 * Validates req.body / req.query / req.params against zod schemas, replacing
 * scattered manual `if (!field) return res.status(400)...` checks in
 * controllers with one consistent, declarative layer. On success, the
 * parsed (and type-coerced, e.g. numeric query params) values are written
 * back onto req so controllers can trust their shape.
 *
 * Usage: router.post('/', validate({ body: createRestaurantSchema }), createRestaurant)
 */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const issues = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return res.status(400).json({ error: 'Invalid request.', issues });
      }
      next(err);
    }
  };
}
