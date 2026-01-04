import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { 
  getTasksByProjectId,
  createTaskService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  createSubTaskService,
  deleteSubTaskService,
  updateSubTaskService
} from "../services/task.service.js";

export const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const tasks = await getTasksByProjectId(projectId);

  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "Tasks fetched successfully"));
});

export const createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedToId, status } = req.body;
  const { projectId } = req.params;
  const userId = req.user.id;

  const task = await createTaskService({
    title,
    description,
    assignedToId,
    status,
    projectId,
    userId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, task, "Task created successfully"));
});

export const getTaskById = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;

  const task = await getTaskByIdService(projectId, taskId);

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task fetched successfully"));
});


export const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title, description, status, assignedToId } = req.body;

  const updatedTask = await updateTaskService(taskId, {
    title,
    description,
    status,
    assignedToId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTask, "Task updated successfully"));
});

export const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  await deleteTaskService(taskId);

  return res.status(204).send();
});

export const createSubTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { title } = req.body;
  const createdById = req.user.id;

  const subtask = await createSubTaskService({
    taskId,
    title,
    createdById,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, subtask, "Subtask created successfully"));
});

export const deleteSubTask = asyncHandler(async (req, res) => {
  const { subTaskId } = req.params;

  await deleteSubTaskService(subTaskId);

  return res.status(204).send();
});

export const updateSubTask = asyncHandler(async (req, res) => {
  const { taskId, subTaskId } = req.params;
  const { title, isCompleted } = req.body;

  const updatedSubTask = await updateSubTaskService(
    taskId,
    subTaskId,
    { title, isCompleted }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedSubTask, "Subtask updated successfully"));
});