import prisma from "../prisma.js";
import { ApiError } from "../utils/api-error.js";

export const getTasksByProjectId = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const tasks = await prisma.task.findMany({
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

  return tasks;
};

export const createTaskService = async ({
  title,
  description,
  assignedToId,
  status,
  projectId,
  userId,
}) => {
  if (assignedToId) {
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToId },
    });

    if (!assignedUser) {
      throw new ApiError(404, "Assigned user not found");
    }

    const isMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: assignedToId,
          projectId,
        },
      },
    });

    if (!isMember) {
      throw new ApiError(
        400,
        "Cannot assign task to user who is not a project member"
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      projectId,
      createdById: userId,
      assignedToId: assignedToId ?? null,
      ...(status && { status }),
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

  return task;
};

export const getTaskByIdService = async (projectId, taskId) => {
  const task = await prisma.task.findFirst({
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

  if (!task) {
    throw new ApiError(404, "Task not found in this project");
  }

  return task;
};

export const updateTaskService = async (taskId, data) => {
  const { title, description, status, assignedToId } = data;

  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      assignedToId: true,
    },
  });

  if (!existingTask) {
    throw new ApiError(404, "Task not found");
  }

  if (
    assignedToId !== undefined &&
    assignedToId !== existingTask.assignedToId
  ) {
    if (assignedToId) {
      const isMember = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: assignedToId,
            projectId: existingTask.projectId,
          },
        },
      });

      if (!isMember) {
        throw new ApiError(
          400,
          "Cannot assign task to user who is not a project member"
        );
      }
    }
  }

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (assignedToId !== undefined)
    updateData.assignedToId = assignedToId || null;

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
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

  return updatedTask;
};

export const deleteTaskService = async (taskId) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  await prisma.task.delete({
    where: { id: taskId },
  });
};

export const createSubTaskService = async ({
  taskId,
  title,
  createdById,
}) => {
  if (!title) {
    throw new ApiError(400, "Title is required");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const subtask = await prisma.subTask.create({
    data: {
      title,
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

  return subtask;
};

export const deleteSubTaskService = async (subTaskId) => {
  const subtask = await prisma.subTask.findUnique({
    where: { id: subTaskId },
  });

  if (!subtask) {
    throw new ApiError(404, "Subtask not found");
  }

  await prisma.subTask.delete({
    where: { id: subTaskId },
  });
};

export const updateSubTaskService = async (
  taskId,
  subTaskId,
  data
) => {
  const { title, isCompleted } = data;

  const subtask = await prisma.subTask.findUnique({
    where: { id: subTaskId },
  });

  if (!subtask) {
    throw new ApiError(404, "Subtask not found");
  }

  if (subtask.taskId !== taskId) {
    throw new ApiError(400, "Subtask does not belong to this task");
  }

  const updatedSubTask = await prisma.subTask.update({
    where: { id: subTaskId },
    data: {
      ...(title !== undefined && { title }),
      ...(isCompleted !== undefined && { isCompleted }),
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

  return updatedSubTask;
};