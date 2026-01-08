import { jest } from "@jest/globals";

jest.unstable_mockModule("../prisma.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(), 
    },
    projectMember: {
      findMany: jest.fn(),
      upsert: jest.fn(), 
      findFirst: jest.fn(), 
      update: jest.fn(),   
      delete: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));


const { prisma } = await import("../prisma.js");
import { ApiError } from "../utils/api-error.js";
const { 
  getProjectsService, 
  getProjectByIdService,
  createProjectService,
  updateProjectService,
  deleteProjectService,
  addMembersToProjectService,
  getProjectMembersService,
  updateMemberRoleService,
  deleteMemberService
} = await import("./project.service.js");

import pkg from "@prisma/client";
const { UserRole } = pkg;

describe("ProjectService", () => {

    afterEach(() => {
      jest.clearAllMocks();
    });

  describe("getProjectsService", () => {
    it("should return formatted projects for a user", async () => {
      const userId = "user-123";

      prisma.projectMember.findMany.mockResolvedValue([
        {
          role: "OWNER",
          project: {
            id: "project-1",
            name: "Project Alpha",
            description: "Test project",
            _count: {
              members: 3
            },
            creator: {
              id: "creator-1",
              username: "john",
              fullName: "John Doe",
              email: "john@test.com"
            }
          }
        }
      ]);

      const result = await getProjectsService(userId);

      expect(prisma.projectMember.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          project: {
            include: {
              _count: {
                select: { members: true }
              },
              creator: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      expect(result).toEqual([
        {
          id: "project-1",
          name: "Project Alpha",
          description: "Test project",
          membersCount: 3,
          role: "OWNER",
          createdBy: {
            id: "creator-1",
            username: "john",
            fullName: "John Doe",
            email: "john@test.com"
          }
        }
      ]);
    });

    it("should return an empty array when user has no projects", async () => {
      prisma.projectMember.findMany.mockResolvedValue([]);

      const result = await getProjectsService("user-123");

      expect(result).toEqual([]);
    });

    it("should propagate prisma errors", async () => {
      prisma.projectMember.findMany.mockRejectedValue(
        new Error("Database error")
      );

      await expect(getProjectsService("user-123"))
        .rejects
        .toThrow("Database error");
    });
  });

  describe("getProjectByIdService", () => {
    it("should return a project when it exists", async () => {
      const projectId = "project-123";

      const mockProject = {
        id: projectId,
        name: "Test Project",
        description: "Some description",
        createdBy: "user-1",
      };

      prisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await getProjectByIdService(projectId);

      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: projectId },
      });

      expect(result).toEqual(mockProject);
    });

    it("should throw ApiError when project is not found", async () => {
      const projectId = "project-404";

      prisma.project.findUnique.mockResolvedValue(null);

      await expect(getProjectByIdService(projectId)).rejects.toMatchObject({
        statusCode: 404,
        message: "Project not found",
      });
    });
  });

  describe("createProjectService", () => {
    it("should create a project and assign the creator as OWNER", async () => {
      const userId = "user-123";

      const input = {
        name: "My Project",
        description: "Project description",
      };

      const mockProject = {
        id: "project-1",
        name: "My Project",
        description: "Project description",
        createdBy: userId,
        members: [
          {
            userId,
            role: UserRole.OWNER,
          },
        ],
      };

      prisma.project.create.mockResolvedValue(mockProject);

      const result = await createProjectService(userId, input);

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          description: input.description,
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

      expect(result).toEqual(mockProject);
    });
  });

  describe("updateProjectService", () => {
    it("should update project name and description", async () => {
      const projectId = "project-123";

      const updatedProject = {
        id: projectId,
        name: "New name",
        description: "New description",
        updatedAt: new Date(),
      };

      prisma.project.update.mockResolvedValue(updatedProject);

      const result = await updateProjectService(projectId, {
        name: "New name",
        description: "New description",
      });

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          name: "New name",
          description: "New description",
        },
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
        },
      });

      expect(result).toEqual(updatedProject);
    });

    it("should update only the name when description is not provided", async () => {
      const projectId = "project-456";

      const updatedProject = {
        id: projectId,
        name: "Updated name",
        description: "Old description",
        updatedAt: new Date(),
      };

      prisma.project.update.mockResolvedValue(updatedProject);

      const result = await updateProjectService(projectId, {
        name: "Updated name",
      });

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          name: "Updated name",
        },
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
        },
      });

      expect(result).toEqual(updatedProject);
    });

    it("should update only the description when name is not provided", async () => {
      const projectId = "project-789";

      const updatedProject = {
        id: projectId,
        name: "Old name",
        description: "Updated description",
        updatedAt: new Date(),
      };

      prisma.project.update.mockResolvedValue(updatedProject);

      const result = await updateProjectService(projectId, {
        description: "Updated description",
      });

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          description: "Updated description",
        },
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true,
        },
      });

      expect(result).toEqual(updatedProject);
    });
  });

  describe("deleteProjectService", () => {
    it("should delete a project by id", async () => {
      const projectId = "project-123";

      const deletedProject = {
        id: projectId,
        name: "Deleted project",
        description: "Some description",
      };

      prisma.project.delete.mockResolvedValue(deletedProject);

      const result = await deleteProjectService(projectId);

      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: projectId },
      });

      expect(result).toEqual(deletedProject);
    });

    it("should propagate prisma errors", async () => {
      const projectId = "project-456";

      const prismaError = new Error("Database error");

      prisma.project.delete.mockRejectedValue(prismaError);

      await expect(deleteProjectService(projectId)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("addMembersToProjectService", () => {
    it("should add a member to the project when user exists", async () => {
      const projectId = "project-123";

      const user = {
        id: "user-123",
        email: "test@email.com",
      };

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.projectMember.upsert.mockResolvedValue({});

      const result = await addMembersToProjectService(projectId, {
        email: "test@email.com",
        role: "MEMBER",
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@email.com" },
      });

      expect(prisma.projectMember.upsert).toHaveBeenCalledWith({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId,
          },
        },
        update: { role: "MEMBER" },
        create: {
          userId: user.id,
          projectId,
          role: "MEMBER",
        },
      });

      expect(result).toBe(true);
    });

    it("should throw ApiError when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        addMembersToProjectService("project-456", {
          email: "notfound@email.com",
          role: "MEMBER",
        })
      ).rejects.toThrow(ApiError);

      await expect(
        addMembersToProjectService("project-456", {
          email: "notfound@email.com",
          role: "MEMBER",
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "User does not exist",
      });

      expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
    });

    it("should propagate prisma errors", async () => {
      const user = {
        id: "user-789",
        email: "error@email.com",
      };

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.projectMember.upsert.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        addMembersToProjectService("project-789", {
          email: "error@email.com",
          role: "ADMIN",
        })
      ).rejects.toThrow("Database error");
    });
  });

  describe("getProjectMembersService", () => {
    it("should return project members when project exists", async () => {
      const projectId = "project-123";

      const members = [
        {
          id: "member-1",
          role: "OWNER",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          user: {
            id: "user-1",
            username: "johndoe",
            fullName: "John Doe",
            email: "john@email.com",
          },
        },
        {
          id: "member-2",
          role: "MEMBER",
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date("2024-01-04"),
          user: {
            id: "user-2",
            username: "janedoe",
            fullName: "Jane Doe",
            email: "jane@email.com",
          },
        },
      ];

      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        name: "Test Project",
        members,
      });

      const result = await getProjectMembersService(projectId);

      expect(prisma.project.findUnique).toHaveBeenCalledWith({
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

      expect(result).toEqual(members);
    });

    it("should throw ApiError when project is not found", async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        getProjectMembersService("project-404")
      ).rejects.toThrow(ApiError);

      await expect(
        getProjectMembersService("project-404")
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Project not found",
      });
    });

    it("should propagate prisma errors", async () => {
      prisma.project.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        getProjectMembersService("project-500")
      ).rejects.toThrow("Database error");
    });
  });

  describe("updateMemberRoleService", () => {
    it("should throw ApiError when project member is not found", async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);

      await expect(
        updateMemberRoleService("project-1", "user-1", "ADMIN")
      ).rejects.toThrow(ApiError);

      await expect(
        updateMemberRoleService("project-1", "user-1", "ADMIN")
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Project member not found",
      });
    });

    it("should throw ApiError when trying to change the project owner's role", async () => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-1",
        userId: "user-1",
        projectId: "project-1",
        role: "OWNER",
        project: {
          id: "project-1",
          name: "Test Project",
          createdBy: "user-1",
        },
      });

      await expect(
        updateMemberRoleService("project-1", "user-1", "ADMIN")
      ).rejects.toThrow(ApiError);

      await expect(
        updateMemberRoleService("project-1", "user-1", "ADMIN")
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Cannot change the project owner's role",
      });

      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });

    it("should throw ApiError when trying to assign OWNER role", async () => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-2",
        userId: "user-2",
        projectId: "project-1",
        role: "ADMIN",
        project: {
          id: "project-1",
          name: "Test Project",
          createdBy: "user-1",
        },
      });

      await expect(
        updateMemberRoleService("project-1", "user-2", "OWNER")
      ).rejects.toThrow(ApiError);

      await expect(
        updateMemberRoleService("project-1", "user-2", "OWNER")
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Cannot assign OWNER role",
      });

      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });

    it("should update member role when all validations pass", async () => {
      const projectMember = {
        id: "member-3",
        userId: "user-3",
        projectId: "project-1",
        role: "MEMBER",
        project: {
          id: "project-1",
          name: "Test Project",
          createdBy: "user-1",
        },
      };

      const updatedMember = {
        id: "member-3",
        role: "ADMIN",
        user: {
          id: "user-3",
          username: "johndoe",
          fullName: "John Doe",
          email: "john@email.com",
        },
        project: {
          id: "project-1",
          name: "Test Project",
        },
      };

      prisma.projectMember.findFirst.mockResolvedValue(projectMember);
      prisma.projectMember.update.mockResolvedValue(updatedMember);

      const result = await updateMemberRoleService(
        "project-1",
        "user-3",
        "ADMIN"
      );

      expect(prisma.projectMember.update).toHaveBeenCalledWith({
        where: { id: projectMember.id },
        data: { role: "ADMIN" },
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

      expect(result).toEqual(updatedMember);
    });

    it("should propagate prisma errors", async () => {
      prisma.projectMember.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        updateMemberRoleService("project-1", "user-3", "ADMIN")
      ).rejects.toThrow("Database error");
    });
  });

  describe("deleteMemberService", () => {
    it("should throw ApiError when project member is not found", async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);

      await expect(
        deleteMemberService("project-1", "member-1", "requester-1")
      ).rejects.toThrow(ApiError);

      await expect(
        deleteMemberService("project-1", "member-1", "requester-1")
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Project member not found",
      });
    });

    it("should throw ApiError when trying to remove the project owner", async () => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-owner",
        role: "OWNER",
        userId: "owner-1",
        projectId: "project-1",
        project: {
          createdBy: "owner-1",
        },
        user: {
          id: "owner-1",
          username: "owner",
          fullName: "Project Owner",
          email: "owner@email.com",
        },
      });

      await expect(
        deleteMemberService("project-1", "member-owner", "owner-1")
      ).rejects.toThrow(ApiError);

      await expect(
        deleteMemberService("project-1", "member-owner", "owner-1")
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Cannot remove the project owner",
      });

      expect(prisma.projectMember.delete).not.toHaveBeenCalled();
    });

    it("should throw ApiError when non-owner tries to remove an ADMIN", async () => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: "member-admin",
        role: "ADMIN",
        userId: "admin-1",
        projectId: "project-1",
        project: {
          createdBy: "owner-1",
        },
        user: {
          id: "admin-1",
          username: "admin",
          fullName: "Admin User",
          email: "admin@email.com",
        },
      });

      await expect(
        deleteMemberService("project-1", "member-admin", "user-2")
      ).rejects.toThrow(ApiError);

      await expect(
        deleteMemberService("project-1", "member-admin", "user-2")
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Only the owner can remove admins",
      });

      expect(prisma.projectMember.delete).not.toHaveBeenCalled();
    });

    it("should allow the owner to remove an ADMIN", async () => {
      const member = {
        id: "member-admin",
        role: "ADMIN",
        userId: "admin-1",
        projectId: "project-1",
        project: {
          createdBy: "owner-1",
        },
        user: {
          id: "admin-1",
          username: "admin",
          fullName: "Admin User",
          email: "admin@email.com",
        },
      };

      prisma.projectMember.findFirst.mockResolvedValue(member);
      prisma.projectMember.delete.mockResolvedValue({});

      const result = await deleteMemberService(
        "project-1",
        "member-admin",
        "owner-1"
      );

      expect(prisma.projectMember.delete).toHaveBeenCalledWith({
        where: { id: "member-admin" },
      });

      expect(result).toEqual(member.user);
    });

    it("should remove a non-admin project member", async () => {
      const member = {
        id: "member-regular",
        role: "MEMBER",
        userId: "user-3",
        projectId: "project-1",
        project: {
          createdBy: "owner-1",
        },
        user: {
          id: "user-3",
          username: "member",
          fullName: "Regular Member",
          email: "member@email.com",
        },
      };

      prisma.projectMember.findFirst.mockResolvedValue(member);
      prisma.projectMember.delete.mockResolvedValue({});

      const result = await deleteMemberService(
        "project-1",
        "member-regular",
        "any-user"
      );

      expect(prisma.projectMember.delete).toHaveBeenCalledWith({
        where: { id: "member-regular" },
      });

      expect(result).toEqual(member.user);
    });

    it("should propagate prisma errors", async () => {
      prisma.projectMember.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        deleteMemberService("project-1", "member-1", "requester-1")
      ).rejects.toThrow("Database error");
    });
  });

});
