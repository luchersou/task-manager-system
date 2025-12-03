import { Router } from "express";
import pkg from "@prisma/client";
const { UserRole } = pkg;
import { verifyJWT, validateProjectPermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import * as schemas from "../validators/task.validator.js";
import * as taskController from "../controllers/task.controllers.js";

const CONTRIBUTOR_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER];
const MANAGER_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER];

const router = Router();
router.use(verifyJWT);

router
  .route("/projects/:projectId/tasks")
  .get(
    validateProjectPermission(),
    validate(schemas.getTasksSchema),
    taskController.getTasks
  )
  .post(
    validateProjectPermission(CONTRIBUTOR_ROLES),
    validate(schemas.createTaskSchema),
    taskController.createTask
  );

router
  .route("/:projectId/tasks/:taskId")
  .get(
    validateProjectPermission(),
    validate(schemas.getTaskByIdSchema),
    taskController.getTaskById
  )
  .patch(
    validateProjectPermission(CONTRIBUTOR_ROLES),
    validate(schemas.updateTaskSchema),
    taskController.updateTask
  )
  .delete(
    validateProjectPermission(MANAGER_ROLES),
    validate(schemas.deleteTaskSchema),
    taskController.deleteTask
  );

router
  .route("/:taskId/subtasks")
  .post(
    validateProjectPermission(CONTRIBUTOR_ROLES),
    validate(schemas.createSubTaskSchema),
    taskController.createSubTask
  );

router
  .route("/:taskId/subtasks/:subTaskId")
  .patch(
    validateProjectPermission(CONTRIBUTOR_ROLES),
    validate(schemas.updateSubTaskSchema),
    taskController.updateSubTask
  )
  .delete(
    validateProjectPermission(MANAGER_ROLES),
    validate(schemas.deleteSubTaskSchema),
    taskController.deleteSubTask
  );

export default router;