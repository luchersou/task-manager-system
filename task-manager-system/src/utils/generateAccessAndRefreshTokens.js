import { ApiError } from "../utils/api-error.js";
import { prisma } from "../prisma.js";
import jwt from "jsonwebtoken";

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    process.env.ACCESS_TOKEN_SECRET, 
    { expiresIn: "15m" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
};

export const generateAccessAndRefreshTokens = async (userId) => {
  try {
    console.log("1️⃣ Buscando usuário:", userId);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }
    
    const accessToken = generateAccessToken(user);
    
    const refreshToken = generateRefreshToken(user);

    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };

  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Something went wrong while generating tokens"
    );
  }
};