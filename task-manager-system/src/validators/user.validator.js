import { z } from "zod";

export const userRegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .z.email("Email is invalid"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long")
    .max(30, "Username must be at most 30 characters long")
    .regex(/^[a-z0-9_]+$/, "Username must be lowercase and alphanumeric"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long"),
  fullName: z.string().trim().optional(),
});

export const userLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .z.email("Email is invalid"),
  password: z.string(),
});

export const userChangePasswordSchema = z.object({
  oldPassword: z
    .string()
    .min(1, "Old password is required"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters long")
    .max(15, "New password is too long (maximum 15 characters)"),
});

export const userForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .z.email("Email is invalid"),
});

export const userResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters long"),
});