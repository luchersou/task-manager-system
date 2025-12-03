import { prisma } from "../prisma.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

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

  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "Tasks fetched successfully")
  );
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedToId, status } = req.body;
  const { projectId } = req.params;
  const userId = req.user.id;

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
          projectId: projectId,
        },
      },
    });

    if (!isMember) {
      throw new ApiError(400, "Cannot assign task to user who is not a project member");
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      projectId,
      createdById: userId,
      assignedToId: assignedToId || null,
      ...(status && { status }), 
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true
        },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true
        },
      },
      project: {
        select: {
          id: true,
          name: true
        },
      },
    }
  });

  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully"));
});

const getTaskById = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },   
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

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task fetched successfully"));
});


const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, status, assignedToId } = req.body;

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

  if (assignedToId !== undefined && assignedToId !== existingTask.assignedToId) {
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
        throw new ApiError(400, "Cannot assign task to user who is not a project member");
      }
    }
  }

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;

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

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTask, "Task updated successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  await prisma.task.delete({
    where: { id: taskId },
  });

  return res
    .status(204)
    .json(new ApiResponse(204, null, "Task deleted successfully"));
});

const createSubTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title } = req.body;
  const createdById = req.user.id;

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

  return res
    .status(201)
    .json(new ApiResponse(201, subtask, "Subtask created successfully"));
});

const deleteSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;

  const subtask = await prisma.subTask.findUnique({
    where: { id: subTaskId },
  });

  if (!subtask) {
    throw new ApiError(404, "Subtask not found");
  }

  await prisma.subTask.delete({
    where: { id: subTaskId },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Subtask deleted successfully"));
});

const updateSubTask = asyncHandler(async (req, res) => {
  const { taskId, subTaskId } = req.params;  
  const { title, isCompleted } = req.body;

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

  return res
    .status(200)
    .json(new ApiResponse(200, updatedSubTask, "Subtask updated successfully"));
});

export {
  createSubTask,
  createTask,
  deleteTask,
  deleteSubTask,
  getTaskById,
  getTasks,
  updateSubTask,
  updateTask,
};
