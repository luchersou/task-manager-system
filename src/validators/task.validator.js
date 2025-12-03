import pkg from "@prisma/client";
const { TaskStatus } = pkg;
import { z } from "zod";

const getTasksSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId — must be a UUID"),
  }),
});

const createTaskSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId — must be a UUID"),
  }),
  body: z.object({
    title: z
      .string({
        error: "title is required",
        error: "title must be a string",
      })
      .min(1, "title cannot be empty"),
    description: z
      .string({
        error: "description must be a string",
      })
      .optional(),
    assignedTo: z
      .uuid("assignedTo must be a valid UUID")
      .optional(),
    status: z
      .enum(TaskStatus, {
        error: "Status must be one of: todo, in_progress, done",
      })
      .default("TODO"),
  }),
});

const getTaskByIdSchema = z.object({
  params: z.object({
    taskId: z.uuid("Invalid taskId — must be a UUID"),
  }),
});

const updateTaskSchema = z.object({
  params: z.object({
    taskId: z.uuid("Invalid taskId — must be a UUID"),
  }),
  body: z.object({
    title: z.string().min(1, "title cannot be empty").optional(),
    description: z.string().optional(),
    status: z
      .enum(TaskStatus)
      .optional(),
    assignedToId: z.uuid("assignedToId must be a UUID").optional(),
  }),
});

const deleteTaskSchema = z.object({
  params: z.object({
    taskId: z.uuid("Invalid taskId — must be a UUID"),
  }),
});

const createSubTaskSchema = z.object({
  params: z.object({
    taskId: z.uuid("Invalid taskId — must be a UUID"),
  }),
  body: z.object({
    title: z
      .string({
        error: "title is required",
      })
      .min(1, "title cannot be empty"),
  }),
});

const deleteSubTaskSchema = z.object({
  params: z.object({
    taskId: z.uuid("Invalid taskId — must be a UUID"),
    subTaskId: z.uuid("Invalid subTaskId — must be a UUID"),
  }),
});

const updateSubTaskSchema = z.object({
  params: z.object({
    taskId: z.uuid("Invalid taskId — must be a UUID"), 
    subTaskId: z.uuid("Invalid subTaskId — must be a UUID"),
  }),
  body: z.object({
    title: z.string().min(1, "title cannot be empty").optional(),
    isCompleted: z
      .boolean({
        error: "isCompleted must be a boolean",
      })
      .optional(),
  }),
});

export {
    getTasksSchema,
    createTaskSchema,
    getTaskByIdSchema,
    updateTaskSchema,
    deleteTaskSchema,
    createSubTaskSchema,
    deleteSubTaskSchema,
    updateSubTaskSchema,
}

