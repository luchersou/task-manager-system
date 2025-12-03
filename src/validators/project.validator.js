import { UserRole } from "@prisma/client";
import { z } from "zod";

const getProjectByIdSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId — must be a UUID"),
  }),
});

const createProjectSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, "Project name must be at least 3 characters long")
      .max(100, "Project name must be at most 100 characters long"),
    description: z
      .string()
      .max(500, "Description must be at most 500 characters long")
      .optional(),
  }),
});

const updateProjectSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId format"),
  }),
  body: z.object({
    name: z
      .string()
      .min(3, "Project name must be at least 3 characters long")
      .max(100, "Project name must be at most 100 characters long")
      .optional(),
    description: z
      .string()
      .max(500, "Description must be at most 500 characters long")
      .optional(),
  }),
});

const deleteProjectSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId format"),
  }),
});

const addMembersToProjectSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId format"),
  }),
  body: z.object({
    email: z.email("Invalid email format"),
    role: z.enum(UserRole).optional().default("MEMBER"),
  }),
});

const getProjectMembersSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId format"),
  }),
});

const updateMemberRoleSchema = z.object({
  params: z.object({
    projectId: z.uuid("Invalid projectId format"),
    userId: z.uuid("Invalid userId format"),
  }),
  body: z.object({
    newRole: z.enum(UserRole, {
      errorMap: () => ({
        message: "newRole must be a valid role: OWNER, ADMIN, MANAGER, MEMBER or VIEWER",
      }),
    }),
  }),
});

const deleteMemberSchema = z.object({
  params: z.object({
    projectId: z.uuid({
      error: "Project ID is required"
    }),
    memberId: z.uuid({
      error: "User ID is required"
    }),
  }),
});

export {
  getProjectByIdSchema,
  createProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
  addMembersToProjectSchema,
  getProjectMembersSchema,
  updateMemberRoleSchema,
  deleteMemberSchema,
}
