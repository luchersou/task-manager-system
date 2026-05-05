import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "../utils/api-error.js";
import { errorHandler } from "./error-handler.middleware.js";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const createMockRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createMockReq = () => ({});
const mockNext = vi.fn();

const callHandler = (error, env = "test") => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = env;

  const req = createMockReq();
  const res = createMockRes();

  errorHandler(error, req, res, mockNext);

  process.env.NODE_ENV = originalEnv;
  return res;
};

const getResponse = (res) => res.json.mock.calls[0][0];
const getStatus = (res) => res.status.mock.calls[0][0];

// -------------------------------------------------------
// errorHandler
// -------------------------------------------------------
describe("errorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------
  // Response shape
  // -------------------------------------------------------
  describe("response shape", () => {
    it("should always return success: false", () => {
      const res = callHandler(new ApiError(400, "bad request"));
      expect(getResponse(res)).toMatchObject({ success: false });
    });

    it("should always include statusCode, message and errors fields", () => {
      const res = callHandler(new ApiError(400, "bad request", ["err"]));
      expect(getResponse(res)).toMatchObject({
        statusCode: 400,
        message: "bad request",
        errors: ["err"],
      });
    });

    it("should include stack in development", () => {
      const res = callHandler(new ApiError(500, "oops"), "development");
      expect(getResponse(res)).toHaveProperty("stack");
    });

    it("should not include stack outside development", () => {
      const res = callHandler(new ApiError(500, "oops"), "production");
      expect(getResponse(res)).not.toHaveProperty("stack");
    });

    it("should set res.status with the same statusCode as the response body", () => {
      const res = callHandler(new ApiError(403, "forbidden"));
      expect(getStatus(res)).toBe(403);
      expect(getResponse(res).statusCode).toBe(403);
    });

    it("should default errors to empty array when not provided", () => {
      const error = new Error("generic");
      const res = callHandler(error);
      expect(getResponse(res).errors).toEqual([]);
    });
  });

  // -------------------------------------------------------
  // console.error
  // -------------------------------------------------------
  describe("console.error", () => {
    it("should call console.error in development", () => {
      callHandler(new ApiError(500, "oops"), "development");
      expect(console.error).toHaveBeenCalledOnce();
    });

    it("should not call console.error in production", () => {
      callHandler(new ApiError(500, "oops"), "production");
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should not call console.error in test environment", () => {
      callHandler(new ApiError(500, "oops"), "test");
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // ApiError passthrough
  // -------------------------------------------------------
  describe("ApiError passthrough", () => {
    it("should preserve statusCode from ApiError", () => {
      const res = callHandler(new ApiError(418, "I'm a teapot"));
      expect(getStatus(res)).toBe(418);
    });

    it("should preserve message from ApiError", () => {
      const res = callHandler(new ApiError(418, "I'm a teapot"));
      expect(getResponse(res).message).toBe("I'm a teapot");
    });

    it("should preserve errors array from ApiError", () => {
      const res = callHandler(new ApiError(422, "invalid", [{ field: "name" }]));
      expect(getResponse(res).errors).toEqual([{ field: "name" }]);
    });

    it("should not reprocess an ApiError through other branches", () => {
      const error = new ApiError(403, "forbidden resource");
			const res = callHandler(error);
			expect(getStatus(res)).toBe(403);
			expect(getResponse(res).message).toBe("forbidden resource");
    });
  });

  // -------------------------------------------------------
  // Prisma errors
  // -------------------------------------------------------
  describe("Prisma errors", () => {
    const makePrismaError = (code, meta = {}) => {
      const error = new Error("prisma error");
      error.code = code;
      error.meta = meta;
      return error;
    };

    describe("P2025 — record not found", () => {
      it("should return 404", () => {
        const res = callHandler(makePrismaError("P2025"));
        expect(getStatus(res)).toBe(404);
      });

      it("should return 'Resource not found'", () => {
        const res = callHandler(makePrismaError("P2025"));
        expect(getResponse(res).message).toBe("Resource not found");
      });
    });

    describe("P2002 — unique constraint violation", () => {
      it("should return 409", () => {
        const res = callHandler(makePrismaError("P2002", { target: ["email"] }));
        expect(getStatus(res)).toBe(409);
      });

      it("should include the target field in the message", () => {
        const res = callHandler(makePrismaError("P2002", { target: ["email"] }));
        expect(getResponse(res).message).toBe("email already exists");
      });

      it("should join multiple target fields with comma", () => {
        const res = callHandler(makePrismaError("P2002", { target: ["email", "username"] }));
        expect(getResponse(res).message).toBe("email, username already exists");
      });

      it("should fallback to 'field' when meta.target is missing", () => {
        const res = callHandler(makePrismaError("P2002", {}));
        expect(getResponse(res).message).toBe("field already exists");
      });
    });

    describe("P2003 — foreign key constraint", () => {
      it("should return 400", () => {
        const res = callHandler(makePrismaError("P2003", { field_name: "userId" }));
        expect(getStatus(res)).toBe(400);
      });

      it("should include the field name in the message", () => {
        const res = callHandler(makePrismaError("P2003", { field_name: "userId" }));
        expect(getResponse(res).message).toBe("Invalid userId reference");
      });

      it("should fallback to 'relation' when meta.field_name is missing", () => {
        const res = callHandler(makePrismaError("P2003", {}));
        expect(getResponse(res).message).toBe("Invalid relation reference");
      });
    });

    describe("P2014 — invalid ID", () => {
      it("should return 400 with 'Invalid ID provided'", () => {
        const res = callHandler(makePrismaError("P2014"));
        expect(getStatus(res)).toBe(400);
        expect(getResponse(res).message).toBe("Invalid ID provided");
      });
    });

    describe("P2000 — value too long", () => {
      it("should return 400 with column name in message", () => {
        const res = callHandler(makePrismaError("P2000", { column_name: "bio" }));
        expect(getStatus(res)).toBe(400);
        expect(getResponse(res).message).toBe("Value too long for bio");
      });

      it("should fallback to 'field' when meta.column_name is missing", () => {
        const res = callHandler(makePrismaError("P2000", {}));
        expect(getResponse(res).message).toBe("Value too long for field");
      });
    });

    describe("P2011 — null constraint violation", () => {
      it("should return 400 with constraint name in message", () => {
        const res = callHandler(makePrismaError("P2011", { constraint: "email" }));
        expect(getStatus(res)).toBe(400);
        expect(getResponse(res).message).toBe("email is required");
      });

      it("should fallback to 'field' when meta.constraint is missing", () => {
        const res = callHandler(makePrismaError("P2011", {}));
        expect(getResponse(res).message).toBe("field is required");
      });
    });

    describe("P2012 — missing required value", () => {
      it("should return 400 with path in message", () => {
        const res = callHandler(makePrismaError("P2012", { path: "user.email" }));
        expect(getStatus(res)).toBe(400);
        expect(getResponse(res).message).toBe("Missing required value: user.email");
      });

      it("should fallback to 'field' when meta.path is missing", () => {
        const res = callHandler(makePrismaError("P2012", {}));
        expect(getResponse(res).message).toBe("Missing required value: field");
      });
    });

    describe("P2015 — related record not found", () => {
      it("should return 404 with 'Related record not found'", () => {
        const res = callHandler(makePrismaError("P2015"));
        expect(getStatus(res)).toBe(404);
        expect(getResponse(res).message).toBe("Related record not found");
      });
    });

    describe("P2016 — invalid query parameters", () => {
      it("should return 400 with 'Invalid query parameters'", () => {
        const res = callHandler(makePrismaError("P2016"));
        expect(getStatus(res)).toBe(400);
        expect(getResponse(res).message).toBe("Invalid query parameters");
      });
    });

    describe("unknown Prisma error (P-prefixed code)", () => {
      it("should return 400 in production with generic message", () => {
        const res = callHandler(makePrismaError("P9999"), "production");
        expect(getStatus(res)).toBe(400);
        expect(getResponse(res).message).toBe("Database operation failed");
      });

      it("should return 400 in development with the original error message", () => {
        const error = makePrismaError("P9999");
        error.message = "some internal db detail";
        const res = callHandler(error, "development");
        expect(getStatus(res)).toBe(400);
        expect(getResponse(res).message).toContain("some internal db detail");
      });
    });
  });

  // -------------------------------------------------------
  // Named error types
  // -------------------------------------------------------
  describe("PrismaClientValidationError", () => {
    it("should return 400 with 'Invalid data provided'", () => {
      const error = new Error("validation detail");
      error.name = "PrismaClientValidationError";
      const res = callHandler(error);
      expect(getStatus(res)).toBe(400);
      expect(getResponse(res).message).toBe("Invalid data provided");
    });

    it("should include the original message in errors array", () => {
      const error = new Error("validation detail");
      error.name = "PrismaClientValidationError";
      const res = callHandler(error);
      expect(getResponse(res).errors).toContain("validation detail");
    });
  });

  describe("ZodError", () => {
    const makeZodError = (issues = []) => {
      const error = new Error("zod");
      error.name = "ZodError";
      error.errors = issues;
      return error;
    };

    it("should return 400 with 'Validation failed'", () => {
      const res = callHandler(makeZodError([{ path: ["email"], message: "Invalid email" }]));
      expect(getStatus(res)).toBe(400);
      expect(getResponse(res).message).toBe("Validation failed");
    });

    it("should map issues to { field, message }", () => {
      const res = callHandler(makeZodError([{ path: ["email"], message: "Invalid email" }]));
      expect(getResponse(res).errors).toEqual([{ field: "email", message: "Invalid email" }]);
    });

    it("should join nested path segments with dot notation", () => {
      const res = callHandler(makeZodError([{ path: ["user", "email"], message: "Required" }]));
      expect(getResponse(res).errors[0].field).toBe("user.email");
    });

    it("should handle multiple issues", () => {
      const res = callHandler(makeZodError([
        { path: ["name"], message: "Required" },
        { path: ["email"], message: "Invalid email" },
      ]));
      expect(getResponse(res).errors).toHaveLength(2);
    });

    it("should return empty errors array when issues are missing", () => {
      const error = new Error("zod");
      error.name = "ZodError";
      // errors field intentionally absent
      const res = callHandler(error);
      expect(getResponse(res).errors).toEqual([]);
    });
  });

  describe("JsonWebTokenError", () => {
    it("should return 401 with 'Invalid token'", () => {
      const error = new Error("jwt malformed");
      error.name = "JsonWebTokenError";
      const res = callHandler(error);
      expect(getStatus(res)).toBe(401);
      expect(getResponse(res).message).toBe("Invalid token");
    });
  });

  describe("TokenExpiredError", () => {
    it("should return 401 with 'Token expired'", () => {
      const error = new Error("jwt expired");
      error.name = "TokenExpiredError";
      const res = callHandler(error);
      expect(getStatus(res)).toBe(401);
      expect(getResponse(res).message).toBe("Token expired");
    });
  });

  describe("SyntaxError with status 400 and body", () => {
    it("should return 400 with 'Invalid JSON format'", () => {
      const error = new SyntaxError("Unexpected token");
      error.status = 400;
      error.body = "raw body";
      const res = callHandler(error);
      expect(getStatus(res)).toBe(400);
      expect(getResponse(res).message).toBe("Invalid JSON format");
    });

    it("should include the original message in errors", () => {
      const error = new SyntaxError("Unexpected token");
      error.status = 400;
      error.body = "raw body";
      const res = callHandler(error);
      expect(getResponse(res).errors).toContain("Unexpected token");
    });

    it("should not match SyntaxError without status 400", () => {
      const error = new SyntaxError("some syntax issue");
      // no status, no body — falls through to generic handler
      const res = callHandler(error);
      expect(getStatus(res)).toBe(500);
    });

    it("should not match SyntaxError without body property and return status from error.status", () => {
			const error = new SyntaxError("some syntax issue");
			error.status = 400;
			const res = callHandler(error);
			expect(getStatus(res)).toBe(400);
			expect(getResponse(res).message).toBe("some syntax issue");
		});
  });

  // -------------------------------------------------------
  // Generic fallback
  // -------------------------------------------------------
  describe("generic error fallback", () => {
    it("should return 500 for unknown errors", () => {
      const res = callHandler(new Error("something broke"));
      expect(getStatus(res)).toBe(500);
    });

    it("should use error.statusCode when available", () => {
      const error = new Error("not found");
      error.statusCode = 404;
      const res = callHandler(error);
      expect(getStatus(res)).toBe(404);
    });

    it("should use error.status when statusCode is absent", () => {
      const error = new Error("gone");
      error.status = 410;
      const res = callHandler(error);
      expect(getStatus(res)).toBe(410);
    });

    it("should prefer statusCode over status", () => {
      const error = new Error("conflict");
      error.statusCode = 409;
      error.status = 500;
      const res = callHandler(error);
      expect(getStatus(res)).toBe(409);
    });

    it("should censor message in production when status is 500", () => {
      const error = new Error("sensitive internal detail");
      const res = callHandler(error, "production");
      expect(getResponse(res).message).toBe("Internal server error");
    });

    it("should expose message in production when status is not 500", () => {
      const error = new Error("resource not found");
      error.statusCode = 404;
      const res = callHandler(error, "production");
      expect(getResponse(res).message).toBe("resource not found");
    });

    it("should expose message in development even for 500", () => {
      const error = new Error("sensitive internal detail");
      const res = callHandler(error, "development");
      expect(getResponse(res).message).toBe("sensitive internal detail");
    });

    it("should fallback to 'Something went wrong' when message is absent", () => {
      const error = new Error();
      error.message = "";
      const res = callHandler(error, "development");
      expect(getResponse(res).message).toBe("Something went wrong");
    });
  });
});