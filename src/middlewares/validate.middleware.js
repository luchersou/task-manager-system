import { ZodError } from "zod";

export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = Array.isArray(error.errors) 
        ? error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        : [];

      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }
    next(error);
  }
};