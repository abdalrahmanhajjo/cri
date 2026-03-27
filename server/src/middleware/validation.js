/**
 * Zod validation middleware for Express.
 * Usage: app.post('/route', validate(mySchema), (req, res) => ...)
 */
const validate = (schema) => (req, res, next) => {
  try {
    // Validate request body, query, and params if provided in schema
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      });
    }

    // Overwrite with parsed data (handles type conversion/defaults if any)
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;
    
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { validate };
