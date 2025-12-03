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
    console.log("ZOD RAW ERROR =>", error);
    if (error instanceof ZodError) {
      console.log("ZOD ISSUES =>", error.issues);

      const errors = error.issues.map(err => ({
        path: err.path.join("."),
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        message: errors[0]?.message || "Validation error", // ✅ agora personalizado
        errors,
      });
    }

    next(error);
  }
};
