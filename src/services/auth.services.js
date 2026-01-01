import { prisma } from "../prisma.js";
import { ApiError } from "../utils/api-error.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateAccessAndRefreshTokens } from "../utils/generateAccessAndRefreshTokens.js";
import jwt from "jsonwebtoken";

export const registerUserService = async ({ email, username, password, fullName }) => {
  if (!email || !username || !password) {
    throw new ApiError(400, "All fields are required: email, username, password");
  }

  const existedUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      fullName,
    },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  return user;
};

export const loginService = async ({ identifier, password }) => {
  if (!identifier || !password) {
    throw new ApiError(400, "Email/username and password are required");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier }
      ]
    }
  });

  if (!user) {
    throw new ApiError(400, "Invalid credentials");
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);
  const { password: _, refreshToken: __, ...safeUser } = user;

  return { safeUser, accessToken, refreshToken };
};

export const logoutUserService = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: "" },
  });

  return true;
};

export const refreshAccessTokenService = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized access");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.id },
    });

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token expired or invalid");
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
    } = await generateAccessAndRefreshTokens(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
};

export const changeCurrentPasswordService = async (userId, { oldPassword, newPassword }) => {
  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await comparePassword(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid old password");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      refreshToken: null,
    },
  });

  return true;
};

export const deleteAccountService = async (userId) => {
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new ApiError(404, "User not found");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return true;
};