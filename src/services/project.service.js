import prisma from "../prisma.js";
import { ApiError } from "../utils/api-error.js";
import { UserRole } from "../../prisma/generated/prisma/index.js";

export const getProjectsService = async (userId) => {
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

  return projects;
};

export const getProjectByIdService = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return project;
};

export const createProjectService = async (userId, { name, description }) => {
  const project = await prisma.project.create({
    data: {
      name,
      description,
      createdBy: userId,
      members: {
        create: {
          userId: userId,
          role: UserRole.OWNER,
        },
      },
    },
    include: {
      members: {
        where: { userId: userId },
      },
    },
  });

  return project;
};

export const updateProjectService = async (projectId, { name, description }) => {
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

  return project;
};

export const deleteProjectService = async (projectId) => {
  const project = await prisma.project.delete({
    where: { id: projectId },
  });

  return project;
};

export const addMembersToProjectService = async (projectId, { email, role }) => {
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

  return true;
};

export const getProjectMembersService = async (projectId) => {
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

  return project.members;
};

export const updateMemberRoleService = async (projectId, userId, newRole) => {
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

  return updatedMember;
};

export const deleteMemberService = async (projectId, memberId, requesterId) => {
  const memberToDelete = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    include: {
      project: { select: { createdBy: true } },
      user: { select: { id: true, username: true, fullName: true, email: true } },
    },
  });

  if (!memberToDelete) {
    throw new ApiError(404, "Project member not found");
  }

  if (memberToDelete.project.createdBy === memberToDelete.userId) {
    throw new ApiError(400, "Cannot remove the project owner");
  }

  if (memberToDelete.role === "ADMIN") {
    const isOwner = memberToDelete.project.createdBy === requesterId;
    if (!isOwner) {
      throw new ApiError(403, "Only the owner can remove admins");
    }
  }

  await prisma.projectMember.delete({ where: { id: memberId } });

  return memberToDelete.user;
};