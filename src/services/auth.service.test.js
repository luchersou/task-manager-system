import { jest } from "@jest/globals";

jest.unstable_mockModule("../prisma.js", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.unstable_mockModule("../utils/password.js", () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

jest.unstable_mockModule("../utils/generateAccessAndRefreshTokens.js", () => ({
  generateAccessAndRefreshTokens: jest.fn(),
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    verify: jest.fn(),
  },
}));

import { ApiError } from "../utils/api-error.js";
const { prisma } = await import("../prisma.js");
const jwt = (await import("jsonwebtoken")).default;
const { generateAccessAndRefreshTokens } = await import("../utils/generateAccessAndRefreshTokens.js");
const { hashPassword, comparePassword } = await import("../utils/password.js");
const { 
  registerUserService,
  loginService,
  logoutUserService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  deleteAccountService
 } = await import("./auth.service.js");

import pkg from "@prisma/client";
const { UserRole } = pkg;

describe("registerUserService", () => {
  
  afterEach(() => {
      jest.clearAllMocks();
  });

  it("should throw error if required fields are missing", async () => {
    await expect(
      registerUserService({ email: "", username: "user", password: "123" })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("should throw error if user already exists", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "1" });

    await expect(
      registerUserService({
        email: "test@test.com",
        username: "test",
        password: "123",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("should create user successfully", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    hashPassword.mockResolvedValue("hashed-password");

    prisma.user.create.mockResolvedValue({
      id: "1",
      email: "test@test.com",
      username: "test",
      fullName: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await registerUserService({
      email: "test@test.com",
      username: "test",
      password: "123",
      fullName: "Test User",
    });

    expect(prisma.user.findFirst).toHaveBeenCalled();
    expect(hashPassword).toHaveBeenCalledWith("123");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "test@test.com",
        username: "test",
        password: "hashed-password",
        fullName: "Test User",
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(result.email).toBe("test@test.com");
  });

  describe("loginService", () => {
    it("should throw error if identifier or password is missing", async () => {
      await expect(
        loginService({ identifier: "", password: "123" })
      ).rejects.toBeInstanceOf(ApiError);
    });

    it("should throw error if user not found", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        loginService({ identifier: "test@test.com", password: "123" })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("should throw error if password is invalid", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "1",
        email: "test@test.com",
        username: "test",
        password: "hashed",
        refreshToken: "old-token",
      });

      comparePassword.mockResolvedValue(false);

      await expect(
        loginService({ identifier: "test@test.com", password: "123" })
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("should login successfully", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "1",
        email: "test@test.com",
        username: "test",
        password: "hashed",
        refreshToken: "old-token",
        fullName: "Test User",
      });

      comparePassword.mockResolvedValue(true);

      generateAccessAndRefreshTokens.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      const result = await loginService({
        identifier: "test@test.com",
        password: "123",
      });

      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(comparePassword).toHaveBeenCalledWith("123", "hashed");
      expect(generateAccessAndRefreshTokens).toHaveBeenCalledWith("1");

      expect(result.safeUser.password).toBeUndefined();
      expect(result.safeUser.refreshToken).toBeUndefined();

      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
    });
  });

  describe("logoutUserService", () => {
    it("should clear refreshToken and return true", async () => {
      prisma.user.update.mockResolvedValue({});

      const result = await logoutUserService("user-id-1");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-id-1" },
        data: { refreshToken: "" },
      });

      expect(result).toBe(true);
    });
  });

  describe("refreshAccessTokenService", () => {
    it("should throw error if refresh token is missing", async () => {
      await expect(
        refreshAccessTokenService("")
      ).rejects.toBeInstanceOf(ApiError);
    });

    it("should throw error if user is not found", async () => {
      jwt.verify.mockReturnValue({ id: "1" });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        refreshAccessTokenService("token")
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("should throw error if refresh token does not match stored one", async () => {
      jwt.verify.mockReturnValue({ id: "1" });

      prisma.user.findUnique.mockResolvedValue({
        id: "1",
        refreshToken: "different-token",
      });

      await expect(
        refreshAccessTokenService("token")
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("should refresh tokens successfully", async () => {
      jwt.verify.mockReturnValue({ id: "1" });

      prisma.user.findUnique.mockResolvedValue({
        id: "1",
        refreshToken: "token",
      });

      generateAccessAndRefreshTokens.mockResolvedValue({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });

      prisma.user.update.mockResolvedValue({});

      const result = await refreshAccessTokenService("token");

      expect(jwt.verify).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { refreshToken: "new-refresh" },
      });

      expect(result).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
    });

    it("should throw error if jwt.verify fails", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("invalid");
      });

      await expect(
        refreshAccessTokenService("token")
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("changeCurrentPasswordService", () => {
    it("should throw error if passwords are missing", async () => {
      await expect(
        changeCurrentPasswordService("1", { oldPassword: "", newPassword: "new" })
      ).rejects.toBeInstanceOf(ApiError);
    });

    it("should throw error if userId is missing", async () => {
      await expect(
        changeCurrentPasswordService(null, { oldPassword: "old", newPassword: "new" })
      ).rejects.toBeInstanceOf(ApiError);
    });

    it("should throw error if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        changeCurrentPasswordService("1", { oldPassword: "old", newPassword: "new" })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should throw error if old password is invalid", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "1",
        password: "hashed-old",
      });

      comparePassword.mockResolvedValue(false);

      await expect(
        changeCurrentPasswordService("1", { oldPassword: "old", newPassword: "new" })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("should change password successfully", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "1",
        password: "hashed-old",
      });

      comparePassword.mockResolvedValue(true);
      hashPassword.mockResolvedValue("hashed-new");

      prisma.user.update.mockResolvedValue({});

      const result = await changeCurrentPasswordService("1", {
        oldPassword: "old",
        newPassword: "new",
      });

      expect(comparePassword).toHaveBeenCalledWith("old", "hashed-old");
      expect(hashPassword).toHaveBeenCalledWith("new");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: {
          password: "hashed-new",
          refreshToken: null,
        },
      });

      expect(result).toBe(true);
    });
  });

  describe("deleteAccountService", () => {
    it("should throw error if userId is missing", async () => {
      await expect(deleteAccountService(null)).rejects.toBeInstanceOf(ApiError);
    });

    it("should throw error if user is not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(deleteAccountService("1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should delete account successfully", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "1" });
      prisma.user.delete.mockResolvedValue({});

      const result = await deleteAccountService("1");

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });

      expect(result).toBe(true);
    });
  });
});