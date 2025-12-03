import { Router } from "express";
import * as authController from "../controllers/auth.controllers.js";
import { validate } from "../middlewares/validate.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  registerUserSchema,
  loginSchema,
  refreshAccessTokenSchema,
  changeCurrentPasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

router
  .route("/register")
  .post(
    validate(registerUserSchema),
    authController.registerUser
  );

router
  .route("/login")
  .post(
    validate(loginSchema),
    authController.login
  );

router
  .route("/refresh-token")
  .post(
    validate(refreshAccessTokenSchema),
    authController.refreshAccessToken
  );

router
  .route("/logout")
  .post(verifyJWT, authController.logoutUser);

router
  .route("/me")
  .get(verifyJWT, authController.getCurrentUser)
  .delete(verifyJWT, authController.deleteAccount);

router
  .route("/me/change-password")
  .patch(
    verifyJWT,
    validate(changeCurrentPasswordSchema),
    authController.changeCurrentPassword
  );

export default router;