import { ZodError } from "zod";

export const validate = (schema) => async (req, res, next) => {
  try {
    const validated = await schema.parseAsync({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (validated.body) req.body = validated.body;
    if (validated.params) req.params = validated.params;
    if (validated.query) req.query = validated.query;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map(err => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      }));

      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next(error);
  }
};