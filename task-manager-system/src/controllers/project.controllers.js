import { prisma } from "../prisma.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { UserRole } from "@prisma/client";

const getProjects = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          _count: {
            select: { members: true },
          },
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const projects = memberships.map((m) => ({
    id: m.project.id,
    name: m.project.name,
    description: m.project.description,
    membersCount: m.project._count.members, 
    role: m.role,
    createdBy: m.project.creator,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, projects, "Projects fetched successfully"));
});

const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return res.status(200).json(
    new ApiResponse(200, project, "Project fetched successfully")
  );
});

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await prisma.project.create({
    data: {
      name,
      description,
      createdBy: req.user.id, 
    },
  });

  await prisma.projectMember.create({
    data: {
      userId: req.user.id,
      projectId: project.id,
      role: UserRole.OWNER,
    },
  });

  return res.status(201).json(
    new ApiResponse(201, project, "Project created successfully")
  );
});

const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { projectId } = req.params;

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project updated successfully"));
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await prisma.project.delete({
    where: { id: projectId },
  });

  return res.status(204).json(
    new ApiResponse(204, project, "Project deleted successfully")
  );
});

const addMembersToProject = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const { projectId } = req.params;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  await prisma.projectMember.upsert({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId,
      },
    },
    update: { role },
    create: {
      userId: user.id,
      projectId,
      role,
    },
  });

  return res.status(200).json(
    new ApiResponse(200, {}, "Project member added successfully")
  );
});

const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          id: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        project.members,
        "Project members fetched successfully"
      )
    );
});

const updateMemberRole = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { newRole } = req.body;

  const projectMember = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
    },
    include: {
      project: { 
        select: { 
          id: true,
          name: true,
          createdBy: true  
        } 
      },
    },
  });

  if (!projectMember) {
    throw new ApiError(404, "Project member not found");
  }

  if (projectMember.project.createdBy === userId) {
    throw new ApiError(403, "Cannot change the project owner's role");
  }

  if (newRole === "OWNER") {
    throw new ApiError(403, "Cannot assign OWNER role");
  }

  const updatedMember = await prisma.projectMember.update({
    where: { id: projectMember.id },
    data: { role: newRole },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      updatedMember,
      "Project member role updated successfully"
    )
  );
});

const deleteMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;

  const memberToDelete = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    include: {
      project: { select: { createdBy: true } },
      user: { select: { id: true, username: true, fullName: true, email: true } },
    },
  });

  if (!memberToDelete) {
    throw new ApiError(404, "Project member not found");
  }

  if (memberToDelete.project.createdBy === userId){
    throw new ApiError(400, "Cannot remove the project owner");
  }

  await prisma.projectMember.delete({ where: { id: memberToDelete.id } });

  return res.status(204).json(
    new ApiResponse(204, { removedUser: memberToDelete.user }, "Project member removed successfully")
  );
});

export {
  addMembersToProject,
  createProject,
  deleteMember,
  getProjects,
  getProjectById,
  getProjectMembers,
  updateProject,
  deleteProject,
  updateMemberRole,
};