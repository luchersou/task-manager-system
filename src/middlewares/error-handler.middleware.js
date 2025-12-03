import { ApiError } from "../utils/api-error.js";

const errorHandler = (error, req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.error({
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
      statusCode: error.statusCode,
      constructor: error.constructor.name,
      stack: error.stack?.split("\n").slice(0, 5).join("\n"),
    });
  }

  let processedError = error; 

  if (error.code) {
    switch (error.code) {
      case "P2025":
        processedError = new ApiError(404, "Resource not found", []);
        break;
      case "P2002": {
        const target = error.meta?.target?.join(", ") || "field";
        processedError = new ApiError(409, `${target} already exists`, []);
        break;
      }
      case "P2003": {
        const field = error.meta?.field_name || "relation";
        processedError = new ApiError(400, `Invalid ${field} reference`, []);
        break;
      }
      case "P2014":
        processedError = new ApiError(400, "Invalid ID provided", []);
        break;
      case "P2000": {
        const field = error.meta?.column_name || "field";
        processedError = new ApiError(400, `Value too long for ${field}`, []);
        break;
      }
      case "P2011": {
        const field = error.meta?.constraint || "field";
        processedError = new ApiError(400, `${field} is required`, []);
        break;
      }
      case "P2012": {
        const field = error.meta?.path || "field";
        processedError = new ApiError(400, `Missing required value: ${field}`, []);
        break;
      }
      case "P2015":
        processedError = new ApiError(404, "Related record not found", []);
        break;
      case "P2016":
        processedError = new ApiError(400, "Invalid query parameters", []);
        break;
      default:
        if (error.code?.startsWith("P")) {
          processedError = new ApiError(
            400,
            process.env.NODE_ENV === "development"
              ? `Database error: ${error.message}`
              : "Database operation failed",
            []
          );
        }
    }
  }
  else if (error.name === "PrismaClientValidationError") {
    processedError = new ApiError(400, "Invalid data provided", [error.message]);
  }

  else if (error.name === "ZodError") {
    const errors = error.errors?.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    })) || [];
    
    processedError = new ApiError(400, "Validation failed", errors);
  }

  else if (error.name === "JsonWebTokenError") {
    processedError = new ApiError(401, "Invalid token", []);
  }
  else if (error.name === "TokenExpiredError") {
    processedError = new ApiError(401, "Token expired", []);
  }
  else if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    processedError = new ApiError(400, "Invalid JSON format", [error.message]);
  }

  else if (!(processedError instanceof ApiError)) {
    const statusCode = error.statusCode || error.status || 500;
    const message = 
      process.env.NODE_ENV === "production" && statusCode === 500
        ? "Internal server error"
        : error.message || "Something went wrong";
    
    processedError = new ApiError(statusCode, message, [], error.stack);
  }

  const response = {
    success: false,
    statusCode: processedError.statusCode,
    message: processedError.message,
    errors: processedError.errors || [],
    ...(process.env.NODE_ENV === "development" && { stack: processedError.stack }),
  };

  return res.status(processedError.statusCode).json(response);
};

export { errorHandler };