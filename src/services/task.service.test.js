import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("../prisma.js", () => ({
  default: {
    project: {
      findUnique: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    subTask: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "../prisma.js";
import { ApiError } from "../utils/api-error.js";
import {
  getTasksByProjectId,
  createTaskService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  createSubTaskService,
  updateSubTaskService,
  deleteSubTaskService
} from "./task.service.js";

describe("Task Service", () => {

  afterEach(() => {
      jest.clearAllMocks();
  });

  describe("getTasksByProjectId", () => {
    const projectId = "project-123";

    it("should return tasks when project exists", async () => {
      const mockProject = {
        id: projectId,
        name: "Test Project",
      };

      const mockTasks = [
        {
          id: "task-1",
          title: "Task 1",
          projectId,
          assignedTo: {
            id: "user-1",
            username: "jdoe",
            fullName: "John Doe",
          },
        },
      ];

      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await getTasksByProjectId(projectId);

      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: projectId },
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { projectId },
        include: {
          assignedTo: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      expect(result).toEqual(mockTasks);
    });

    it("should throw 404 error when project does not exist", async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(getTasksByProjectId(projectId)).rejects.toThrow(
        new ApiError(404, "Project not found")
      );

      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });
  });

  describe("createTaskService", () => {
    const projectId = "project-1";
    const userId = "user-creator";
    const assignedToId = "user-assigned";

    it("should create a task without assigned user", async () => {
      const input = {
        title: "Create API",
        description: "Build task creation endpoint",
        projectId,
        userId,
      };

      const createdTask = {
        id: "task-1",
        title: input.title,
        description: input.description,
        assignedTo: null,
        createdBy: { id: userId },
        project: { id: projectId },
      };

      prisma.task.create.mockResolvedValue(createdTask);

      const result = await createTaskService(input);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          title: input.title,
          description: input.description,
          projectId,
          createdById: userId,
          assignedToId: null,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
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

      expect(result).toEqual(createdTask);
    });

    it("should create a task with assigned user who is a project member", async () => {
      const input = {
        title: "Fix bug",
        description: "Fix login issue",
        projectId,
        userId,
        assignedToId,
        status: "IN_PROGRESS",
      };

      const assignedUser = {
        id: assignedToId,
        fullName: "John Doe",
      };

      const projectMember = {
        userId: assignedToId,
        projectId,
      };

      const createdTask = {
        id: "task-2",
        title: input.title,
        assignedTo: assignedUser,
        createdBy: { id: userId },
        project: { id: projectId },
      };

      prisma.user.findUnique.mockResolvedValue(assignedUser);
      prisma.projectMember.findUnique.mockResolvedValue(projectMember);
      prisma.task.create.mockResolvedValue(createdTask);

      const result = await createTaskService(input);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: assignedToId },
      });

      expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_projectId: {
            userId: assignedToId,
            projectId,
          },
        },
      });

      expect(prisma.task.create).toHaveBeenCalled();
      expect(result).toEqual(createdTask);
    });

    it("should throw 404 error if assigned user does not exist", async () => {
      const input = {
        title: "Invalid assignment",
        projectId,
        userId,
        assignedToId,
      };

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(createTaskService(input)).rejects.toThrow(
        new ApiError(404, "Assigned user not found")
      );

      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it("should throw 400 error if assigned user is not a project member", async () => {
      const input = {
        title: "Unauthorized assignment",
        projectId,
        userId,
        assignedToId,
      };

      prisma.user.findUnique.mockResolvedValue({ id: assignedToId });
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(createTaskService(input)).rejects.toThrow(
        new ApiError(
          400,
          "Cannot assign task to user who is not a project member"
        )
      );

      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe("getTaskByIdService", () => {
    const projectId = "project-1";
    const taskId = "task-1";

    it("should return task when it exists in the project", async () => {
      const task = {
        id: taskId,
        title: "Implement feature",
        projectId,
        assignedTo: {
          id: "user-1",
          username: "jdoe",
          fullName: "John Doe",
        },
        subtasks: [
          {
            id: "subtask-1",
            title: "Write tests",
            createdBy: {
              id: "user-2",
              username: "asmith",
              fullName: "Alice Smith",
            },
          },
        ],
      };

      prisma.task.findFirst.mockResolvedValue(task);

      const result = await getTaskByIdService(projectId, taskId);

      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: {
          id: taskId,
          projectId,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          subtasks: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      expect(result).toEqual(task);
    });

    it("should throw 404 error when task does not exist in the project", async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        getTaskByIdService(projectId, taskId)
      ).rejects.toThrow(new ApiError(404, "Task not found in this project"));
    });
  });

  describe("updateTaskService", () => {
    const taskId = "task-1";
    const projectId = "project-1";

    it("should throw 404 error when task does not exist", async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        updateTaskService(taskId, { title: "New title" })
      ).rejects.toThrow(new ApiError(404, "Task not found"));

      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("should throw 400 error when assigning task to a non-project member", async () => {
      const existingTask = {
        id: taskId,
        projectId,
        assignedToId: null,
      };

      prisma.task.findUnique.mockResolvedValue(existingTask);
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        updateTaskService(taskId, { assignedToId: "user-2" })
      ).rejects.toThrow(
        new ApiError(
          400,
          "Cannot assign task to user who is not a project member"
        )
      );

      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("should update task without changing assigned user", async () => {
      const existingTask = {
        id: taskId,
        projectId,
        assignedToId: "user-1",
      };

      const updatedTask = {
        id: taskId,
        title: "Updated title",
        assignedTo: {
          id: "user-1",
          username: "jdoe",
          fullName: "John Doe",
        },
        project: {
          id: projectId,
          name: "Project X",
        },
        _count: {
          subtasks: 2,
        },
      };

      prisma.task.findUnique.mockResolvedValue(existingTask);
      prisma.task.update.mockResolvedValue(updatedTask);

      const result = await updateTaskService(taskId, {
        title: "Updated title",
      });

      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: {
          title: "Updated title",
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              subtasks: true,
            },
          },
        },
      });

      expect(result).toEqual(updatedTask);
    });

    it("should update task with valid assigned user", async () => {
      const existingTask = {
        id: taskId,
        projectId,
        assignedToId: null,
      };

      const projectMember = {
        userId: "user-2",
        projectId,
      };

      const updatedTask = {
        id: taskId,
        assignedTo: {
          id: "user-2",
          username: "asmith",
          fullName: "Alice Smith",
        },
        project: {
          id: projectId,
          name: "Project X",
        },
        _count: {
          subtasks: 0,
        },
      };

      prisma.task.findUnique.mockResolvedValue(existingTask);
      prisma.projectMember.findUnique.mockResolvedValue(projectMember);
      prisma.task.update.mockResolvedValue(updatedTask);

      const result = await updateTaskService(taskId, {
        assignedToId: "user-2",
      });

      expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_projectId: {
            userId: "user-2",
            projectId,
          },
        },
      });

      expect(result).toEqual(updatedTask);
    });
  });

  describe("deleteTaskService", () => {
    const taskId = "task-1";

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw 404 error when task does not exist", async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(deleteTaskService(taskId)).rejects.toThrow(
        new ApiError(404, "Task not found")
      );

      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it("should delete task when it exists", async () => {
      const task = {
        id: taskId,
        title: "Delete me",
      };

      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.delete.mockResolvedValue(undefined);

      await deleteTaskService(taskId);

      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
      });

      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: taskId },
      });
    });
  });

  describe("createSubTaskService", () => {
    const taskId = "task-1";
    const createdById = "user-1";

    it("should throw 400 error when title is missing", async () => {
      await expect(
        createSubTaskService({ taskId, createdById })
      ).rejects.toThrow(new ApiError(400, "Title is required"));

      expect(prisma.task.findUnique).not.toHaveBeenCalled();
      expect(prisma.subTask.create).not.toHaveBeenCalled();
    });

    it("should throw 404 error when task does not exist", async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        createSubTaskService({
          taskId,
          title: "New subtask",
          createdById,
        })
      ).rejects.toThrow(new ApiError(404, "Task not found"));

      expect(prisma.subTask.create).not.toHaveBeenCalled();
    });

    it("should create subtask when data is valid", async () => {
      const task = {
        id: taskId,
      };

      const subtask = {
        id: "subtask-1",
        title: "Write documentation",
        taskId,
        createdBy: {
          id: createdById,
          username: "jdoe",
          fullName: "John Doe",
        },
      };

      prisma.task.findUnique.mockResolvedValue(task);
      prisma.subTask.create.mockResolvedValue(subtask);

      const result = await createSubTaskService({
        taskId,
        title: "Write documentation",
        createdById,
      });

      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
      });

      expect(prisma.subTask.create).toHaveBeenCalledWith({
        data: {
          title: "Write documentation",
          taskId,
          createdById,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      expect(result).toEqual(subtask);
    });
  });

  describe("deleteSubTaskService", () => {
    const subTaskId = "subtask-1";

    it("should throw 404 error when subtask does not exist", async () => {
      prisma.subTask.findUnique.mockResolvedValue(null);

      await expect(deleteSubTaskService(subTaskId)).rejects.toThrow(
        new ApiError(404, "Subtask not found")
      );

      expect(prisma.subTask.delete).not.toHaveBeenCalled();
    });

    it("should delete subtask when it exists", async () => {
      const subtask = {
        id: subTaskId,
        title: "Remove this subtask",
      };

      prisma.subTask.findUnique.mockResolvedValue(subtask);
      prisma.subTask.delete.mockResolvedValue(undefined);

      await deleteSubTaskService(subTaskId);

      expect(prisma.subTask.findUnique).toHaveBeenCalledWith({
        where: { id: subTaskId },
      });

      expect(prisma.subTask.delete).toHaveBeenCalledWith({
        where: { id: subTaskId },
      });
    });
  });

  describe("updateSubTaskService", () => {
    const taskId = "task-1";
    const subTaskId = "subtask-1";

    it("should throw 404 error when subtask does not exist", async () => {
      prisma.subTask.findUnique.mockResolvedValue(null);

      await expect(
        updateSubTaskService(taskId, subTaskId, { title: "New title" })
      ).rejects.toThrow(new ApiError(404, "Subtask not found"));

      expect(prisma.subTask.update).not.toHaveBeenCalled();
    });

    it("should throw 400 error when subtask does not belong to the task", async () => {
      const subtask = {
        id: subTaskId,
        taskId: "another-task",
      };

      prisma.subTask.findUnique.mockResolvedValue(subtask);

      await expect(
        updateSubTaskService(taskId, subTaskId, { title: "Invalid update" })
      ).rejects.toThrow(
        new ApiError(400, "Subtask does not belong to this task")
      );

      expect(prisma.subTask.update).not.toHaveBeenCalled();
    });

    it("should update subtask title", async () => {
      const subtask = {
        id: subTaskId,
        taskId,
      };

      const updatedSubTask = {
        id: subTaskId,
        title: "Updated title",
        isCompleted: false,
        createdBy: {
          id: "user-1",
          username: "jdoe",
          fullName: "John Doe",
        },
      };

      prisma.subTask.findUnique.mockResolvedValue(subtask);
      prisma.subTask.update.mockResolvedValue(updatedSubTask);

      const result = await updateSubTaskService(taskId, subTaskId, {
        title: "Updated title",
      });

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: subTaskId },
        data: {
          title: "Updated title",
        },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      expect(result).toEqual(updatedSubTask);
    });

    it("should update subtask completion status", async () => {
      const subtask = {
        id: subTaskId,
        taskId,
      };

      const updatedSubTask = {
        id: subTaskId,
        title: "Existing title",
        isCompleted: true,
        createdBy: {
          id: "user-1",
          username: "jdoe",
          fullName: "John Doe",
        },
      };

      prisma.subTask.findUnique.mockResolvedValue(subtask);
      prisma.subTask.update.mockResolvedValue(updatedSubTask);

      const result = await updateSubTaskService(taskId, subTaskId, {
        isCompleted: true,
      });

      expect(prisma.subTask.update).toHaveBeenCalledWith({
        where: { id: subTaskId },
        data: {
          isCompleted: true,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      expect(result).toEqual(updatedSubTask);
    });
  });

});
