import { z } from "zod";

const registerUserSchema = z.object({
  body: z.object({
    email: z
      .email("Invalid email format"),
    username: z
      .string({
        error: "Username is required",
      })
      .min(3, "Username must be at least 3 characters long")
      .max(20, "Username must not exceed 20 characters"),
    password: z
      .string({
        error: "Password is required",
      })
      .min(6, "Password must be at least 6 characters long")
      .max(100, "Password must not exceed 100 characters"),
  })
});

const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string({
        error: "Identifier is required",
      })
      .min(3, "Identifier must be at least 3 characters long"),
    password: z
      .string({
        error: "Password is required",
      })
      .min(6, "Password must be at least 6 characters long")
      .max(15, "Password must not exceed 100 characters"),
  })
});

const refreshAccessTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(20, "Invalid refresh token")
      .optional(), 
  }),
});

const changeCurrentPasswordSchema = z.object({
  body: z.object({
    oldPassword: z
      .string({
        error: "Old password is required",
      })
      .min(6, "Old password must be at least 6 characters long"),
    newPassword: z
      .string({
        error: "New password is required",
      })
      .min(6, "New password must be at least 6 characters long"),
  }),
});

export{
  registerUserSchema,
  loginSchema,
  refreshAccessTokenSchema,
  changeCurrentPasswordSchema,  
}