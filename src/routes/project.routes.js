import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as projectController from "../controllers/project.controllers.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateProjectPermission, verifyJWT } from "../middlewares/auth.middleware.js";
import { 
  getProjectByIdSchema,
  createProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
  addMembersToProjectSchema,
  getProjectMembersSchema,
  updateMemberRoleSchema,
  deleteMemberSchema,
} from "../validators/project.validator.js";

const MANAGER_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER];
const ADMIN_ROLES = [UserRole.OWNER, UserRole.ADMIN];

const router = Router();
router.use(verifyJWT);

router
  .route("/")
  .get(projectController.getProjects)
  .post(
    validate(createProjectSchema), 
    projectController.createProject
  );

router
  .route("/:projectId")
  .get(
    validateProjectPermission(),
    validate(getProjectByIdSchema),
    projectController.getProjectById
  )
  .patch(
    validateProjectPermission(MANAGER_ROLES),
    validate(updateProjectSchema),
    projectController.updateProject
  )
  .delete(
    validateProjectPermission([UserRole.OWNER]),
    validate(deleteProjectSchema),
    projectController.deleteProject
  );

router
  .route("/:projectId/members")
  .post(
    validateProjectPermission(MANAGER_ROLES),
    validate(addMembersToProjectSchema),
    projectController.addMembersToProject
  )
  .get(
    validateProjectPermission(),
    validate(getProjectMembersSchema),
    projectController.getProjectMembers
  );

router
  .route("/:projectId/members/:memberId")
  .delete(
    validateProjectPermission(ADMIN_ROLES),
    validate(deleteMemberSchema),
    projectController.deleteMember
  );

router
  .route("/:projectId/members/:userId/role")
  .patch(
    validateProjectPermission(ADMIN_ROLES),
    validate(updateMemberRoleSchema),
    projectController.updateMemberRole
  )

export default router;