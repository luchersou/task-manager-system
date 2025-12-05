import { ZodError } from "zod";

export const validate = (schema) => (req, res, next) => {
  try {
    const toValidate = {};
    
    if (schema.shape?.body) toValidate.body = req.body;
    if (schema.shape?.params) toValidate.params = req.params;
    if (schema.shape?.query) toValidate.query = req.query;
    
    const validated = schema.parse(toValidate);
    
    if (validated.body) req.body = validated.body;
    if (validated.params) req.params = validated.params;
    if (validated.query) req.query = validated.query;
    
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map(err => ({
        field: err.path.slice(1).join(".") || err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next(error);
  }
};