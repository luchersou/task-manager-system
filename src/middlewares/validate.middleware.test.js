import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validate } from "./validate.middleware.js";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const mockNext = vi.fn();

const createMockRes = () => ({
  status: vi.fn().mockReturnThis(),
  json:   vi.fn().mockReturnThis(),
});

const createMockReq = (overrides = {}) => ({
  body:   {},
  params: {},
  query:  {},
  ...overrides,
});

// Simple valid schema for happy path tests
const simpleSchema = z.object({
  body:   z.object({ name: z.string() }).optional(),
  params: z.object({ id: z.string() }).or(z.object({})),
  query:  z.object({ page: z.string() }).or(z.object({})),
});

// -------------------------------------------------------
// validate
// -------------------------------------------------------
describe("validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------
  // Happy path — req mutation
  // -------------------------------------------------------
  describe("on valid schema", () => {
    it("should call next() without arguments", async () => {
      const req = createMockReq({ body: { name: "Lucas" } });
      const res = createMockRes();

      await validate(simpleSchema)(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should mutate req.body with validated data", async () => {
      const req = createMockReq({ body: { name: "Lucas" } });
      const res = createMockRes();

      await validate(simpleSchema)(req, res, mockNext);

      expect(req.body).toEqual({ name: "Lucas" });
    });

    it("should mutate req.params with validated data", async () => {
      const req = createMockReq({ params: { id: "abc-123" } });
      const res = createMockRes();

      await validate(simpleSchema)(req, res, mockNext);

      expect(req.params).toEqual({ id: "abc-123" });
    });

    it("should mutate req.query with validated data", async () => {
      const req = createMockReq({ query: { page: "2" } });
      const res = createMockRes();

      await validate(simpleSchema)(req, res, mockNext);

      expect(req.query).toEqual({ page: "2" });
    });

    it("should not override req.body when schema returns no body", async () => {
      // Schema that only validates params, no body field
      const paramsOnlySchema = z.object({
        params: z.object({ id: z.string() }),
      });

      const originalBody = { name: "Lucas" };
      const req = createMockReq({
        body:   originalBody,
        params: { id: "abc" },
      });
      const res = createMockRes();

      await validate(paramsOnlySchema)(req, res, mockNext);

      expect(req.body).toBe(originalBody);
    });

    it("should not call res.status or res.json on success", async () => {
      const req = createMockReq({ body: { name: "Lucas" } });
      const res = createMockRes();

      await validate(simpleSchema)(req, res, mockNext);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // ZodError — 422 status and error mapping
  // -------------------------------------------------------
  describe("on ZodError", () => {
    it("should return status 422", async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
      });

      const req = createMockReq({ body: { name: 123 } });
      const res = createMockRes();

      await validate(schema)(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it("should return success: false", async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
      });

      const req = createMockReq({ body: { name: 123 } });
      const res = createMockRes();

      await validate(schema)(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it("should return message 'Validation failed'", async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
      });

      const req = createMockReq({ body: { name: 123 } });
      const res = createMockRes();

      await validate(schema)(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Validation failed" })
      );
    });

    it("should map ZodError issues to { field, message, code }", async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
      });

      const req = createMockReq({ body: { name: 123 } });
      const res = createMockRes();

      await validate(schema)(req, res, mockNext);

      const { errors } = res.json.mock.calls[0][0];
      expect(errors[0]).toMatchObject({
        field:   expect.any(String),
        message: expect.any(String),
        code:    expect.any(String),
      });
    });

    it("should join nested path segments with dot notation", async () => {
      const schema = z.object({
        body: z.object({
          user: z.object({ email: z.string().email() }),
        }),
      });

      const req = createMockReq({ body: { user: { email: "not-an-email" } } });
      const res = createMockRes();

      await validate(schema)(req, res, mockNext);

      const { errors } = res.json.mock.calls[0][0];
      // path will be ["body", "user", "email"] → "body.user.email"
      expect(errors[0].field).toBe("body.user.email");
    });

    it("should include all errors when multiple fields are invalid", async () => {
      const schema = z.object({
        body: z.object({
          name:  z.string(),
          email: z.string().email(),
        }),
      });

      const req = createMockReq({ body: { name: 123, email: "invalid" } });
      const res = createMockRes();

      await validate(schema)(req, res, mockNext);

      const { errors } = res.json.mock.calls[0][0];
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it("should not call next() on ZodError", async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
      });

      const req = createMockReq({ body: { name: 123 } });
      const res = createMockRes();

      await validate(schema)(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // Generic error — forwarded to next(error)
  // -------------------------------------------------------
  describe("on generic error", () => {
    it("should call next(error) for non-ZodError exceptions", async () => {
      const dbError = new Error("Unexpected database error");

      // Schema that throws an unexpected error during parsing
      const faultySchema = {
        parseAsync: vi.fn().mockRejectedValue(dbError),
      };

      const req = createMockReq();
      const res = createMockRes();

      await validate(faultySchema)(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it("should not call res.status for generic errors", async () => {
      const faultySchema = {
        parseAsync: vi.fn().mockRejectedValue(new Error("boom")),
      };

      const req = createMockReq();
      const res = createMockRes();

      await validate(faultySchema)(req, res, mockNext);

      expect(res.status).not.toHaveBeenCalled();
    });
  });
});