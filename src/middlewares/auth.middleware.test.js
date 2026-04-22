import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jsonwebtoken");
vi.mock("../prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
    },
  },
}));

import jwt from "jsonwebtoken";
import { verifyJWT, validateProjectPermission } from "./auth.middleware.js";
import prisma from "../prisma.js";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const mockNext = vi.fn();

const createMockReq = (overrides = {}) => ({
  cookies: {},
  header: vi.fn().mockReturnValue(null),
  params: {},
  user: null,
  ...overrides,
});

const createMockRes = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const getMockUser = (overrides = {}) => ({
  id: "user-123",
  username: "lucas",
  email: "lucas@test.com",
  fullName: "Lucas",
  ...overrides,
});

// -------------------------------------------------------
// verifyJWT
// -------------------------------------------------------
describe("verifyJWT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("token extraction", () => {
    it("should throw 401 if neither cookie nor Authorization header is provided", async () => {
      const req = createMockReq();
      const res = createMockRes();

      await verifyJWT(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Unauthorized request - token missing");
    });

    it("should read token from accessToken cookie", async () => {
      const mockUser = getMockUser();
      const req = createMockReq({ cookies: { accessToken: "valid.token" } });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ id: mockUser.id });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await verifyJWT(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should read token from Authorization header when cookie is absent", async () => {
      const mockUser = getMockUser();
      const req = createMockReq({
        header: vi.fn().mockReturnValue("Bearer valid.token"),
      });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ id: mockUser.id });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await verifyJWT(req, res, mockNext);

      expect(req.header).toHaveBeenCalledWith("Authorization");
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should prefer cookie over Authorization header when both are provided", async () => {
      const mockUser = getMockUser();
      const req = createMockReq({
        cookies: { accessToken: "cookie.token" },
        header: vi.fn().mockReturnValue("Bearer header.token"),
      });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ id: mockUser.id });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await verifyJWT(req, res, mockNext);

      // jwt.verify deve ter sido chamado com o token do cookie
      expect(jwt.verify).toHaveBeenCalledWith(
        "cookie.token",
        process.env.ACCESS_TOKEN_SECRET
      );
    });
  });

  describe("token validation", () => {
    it("should throw 401 if jwt.verify throws (token expirado ou assinatura inválida)", async () => {
      const req = createMockReq({ cookies: { accessToken: "expired.token" } });
      const res = createMockRes();

      jwt.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      await verifyJWT(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      // O asyncHandler deve propagar o erro para o next
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should throw 401 if decoded token has no id field", async () => {
      const req = createMockReq({ cookies: { accessToken: "valid.token" } });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ email: "test@test.com" }); // id ausente

      await verifyJWT(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Invalid token payload");
    });

    it("should throw 401 if decoded token id is null", async () => {
      const req = createMockReq({ cookies: { accessToken: "valid.token" } });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ id: null });

      await verifyJWT(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Invalid token payload");
    });
  });

  describe("user lookup", () => {
    it("should query prisma com os campos corretos", async () => {
      const mockUser = getMockUser();
      const req = createMockReq({ cookies: { accessToken: "valid.token" } });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ id: mockUser.id });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await verifyJWT(req, res, mockNext);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
        },
      });
    });

    it("should throw 401 if user is not found in database", async () => {
      const req = createMockReq({ cookies: { accessToken: "valid.token" } });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ id: "ghost-user" });
      prisma.user.findUnique.mockResolvedValue(null);

      await verifyJWT(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Invalid access token - user not found");
    });
  });

  describe("success", () => {
    it("should set req.user with the data returned from database", async () => {
      const mockUser = getMockUser();
      const req = createMockReq({ cookies: { accessToken: "valid.token" } });
      const res = createMockRes();

      jwt.verify.mockReturnValue({ id: mockUser.id });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await verifyJWT(req, res, mockNext);

      expect(req.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});

// -------------------------------------------------------
// validateProjectPermission
// -------------------------------------------------------
describe("validateProjectPermission", () => {
  const mockUser = getMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("projectId resolution", () => {
    it("should throw 400 if neither projectId nor taskId are provided", async () => {
      const req = createMockReq({ user: mockUser, params: {} });
      const res = createMockRes();

      await validateProjectPermission()(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Project ID is missing");
    });

    it("should throw 404 if taskId is provided but task does not exist", async () => {
      const req = createMockReq({
        user: mockUser,
        params: { taskId: "task-404" },
      });
      const res = createMockRes();

      prisma.task.findUnique.mockResolvedValue(null);

      await validateProjectPermission()(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Task not found");
    });

    it("should resolve projectId from task when only taskId is provided", async () => {
      const req = createMockReq({
        user: mockUser,
        params: { taskId: "task-123" },
      });
      const res = createMockRes();

      prisma.task.findUnique.mockResolvedValue({ projectId: "project-456" });
      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "MEMBER",
        projectId: "project-456",
      });

      await validateProjectPermission()(req, res, mockNext);

      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: "task-123" },
        select: { projectId: true },
      });
      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: "project-456" }),
        })
      );
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should use projectId from params directly when provided, ignorando taskId", async () => {
      const req = createMockReq({
        user: mockUser,
        params: { projectId: "project-123", taskId: "task-999" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "MEMBER",
        projectId: "project-123",
      });

      await validateProjectPermission()(req, res, mockNext);

      // Não deve consultar a task pois projectId já está disponível
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: "project-123" }),
        })
      );
    });
  });

  describe("membership check", () => {
    it("should query prisma com userId e projectId corretos", async () => {
      const req = createMockReq({
        user: mockUser,
        params: { projectId: "project-123" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "MEMBER",
        projectId: "project-123",
      });

      await validateProjectPermission()(req, res, mockNext);

      expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: { projectId: "project-123", userId: mockUser.id },
        select: { id: true, role: true, projectId: true },
      });
    });

    it("should throw 404 if user is not a member of the project", async () => {
      const req = createMockReq({
        user: mockUser,
        params: { projectId: "project-123" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue(null);

      await validateProjectPermission()(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("You are not a member of this project");
    });
  });

  describe("role authorization", () => {
    it("should throw 403 if user role is not in the required roles list", async () => {
      const req = createMockReq({
        user: { ...mockUser },
        params: { projectId: "project-123" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "MEMBER",
        projectId: "project-123",
      });

      await validateProjectPermission(["ADMIN", "OWNER"])(req, res, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe(
        "You do not have permission to perform this action"
      );
    });

    it("should call next if user role is in the required roles list", async () => {
      const req = createMockReq({
        user: { ...mockUser },
        params: { projectId: "project-123" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "ADMIN",
        projectId: "project-123",
      });

      await validateProjectPermission(["ADMIN", "OWNER"])(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should call next if roles array is empty (sem restrição de role)", async () => {
      const req = createMockReq({
        user: { ...mockUser },
        params: { projectId: "project-123" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "MEMBER",
        projectId: "project-123",
      });

      await validateProjectPermission([])(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should call next if validateProjectPermission is called with no arguments", async () => {
      const req = createMockReq({
        user: { ...mockUser },
        params: { projectId: "project-123" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "MEMBER",
        projectId: "project-123",
      });

      await validateProjectPermission()(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("success", () => {
    it("should set req.user.role with the member role from database", async () => {
      const req = createMockReq({
        user: { ...mockUser },
        params: { projectId: "project-123" },
      });
      const res = createMockRes();

      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        role: "OWNER",
        projectId: "project-123",
      });

      await validateProjectPermission(["OWNER"])(req, res, mockNext);

      expect(req.user.role).toBe("OWNER");
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});