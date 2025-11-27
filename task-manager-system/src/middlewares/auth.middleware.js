import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request - token missing");
  }

  const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

  if (!decodedToken?.id) {
    throw new ApiError(401, "Invalid token payload");
  }

  const user = await prisma.user.findUnique({
    where: { id: decodedToken.id },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid access token - user not found");
  }

  req.user = user;

  next();
});

export const validateProjectPermission = (roles = []) =>
  asyncHandler(async (req, res, next) => {
    let { projectId } = req.params;        
    const { taskId } = req.params;         

    if (!projectId && taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      });

      if (!task) {
        throw new ApiError(404, "Task not found");
      }

      projectId = task.projectId;
    }

    if (!projectId) {
      throw new ApiError(400, "Project ID is missing");
    }

    const member = await prisma.projectMember.findFirst({
      where: {
        projectId: projectId,
        userId: req.user.id,
      },
      select: {
        id: true,
        role: true,
        projectId: true,
      },
    });

    if (!member) {
      throw new ApiError(404, "You are not a member of this project");
    }

    req.user.role = member.role;

    if (roles.length > 0 && !roles.includes(member.role)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action"
      );
    }

    next();
  });
