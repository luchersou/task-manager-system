import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { 
  getProjectsService, 
  getProjectByIdService,
  createProjectService,
  updateProjectService,
  deleteProjectService,
  addMembersToProjectService,
  getProjectMembersService,
  updateMemberRoleService,
  deleteMemberService
} from "../services/project.service.js";

export const getProjects = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const projects = await getProjectsService(userId);

  return res
    .status(200)
    .json(new ApiResponse(200, projects, "Projects fetched successfully"));
});

export const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await getProjectByIdService(projectId);

  return res.status(200).json(
    new ApiResponse(200, project, "Project fetched successfully")
  );
});

export const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const project = await createProjectService(req.user.id, { name, description });

  return res.status(201).json(
    new ApiResponse(201, project, "Project created successfully")
  );
});

export const updateProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { projectId } = req.params;

  const project = await updateProjectService(projectId, { name, description });

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project updated successfully"));
});

export const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await deleteProjectService(projectId);

  return res.status(204).json(
    new ApiResponse(204, project, "Project deleted successfully")
  );
});

export const addMembersToProject = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const { projectId } = req.params;

  await addMembersToProjectService(projectId, { email, role });

  return res.status(200).json(
    new ApiResponse(200, {}, "Project member added successfully")
  );
});

export const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const members = await getProjectMembersService(projectId);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        members,
        "Project members fetched successfully"
      )
    );
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { newRole } = req.body;

  const updatedMember = await updateMemberRoleService(projectId, userId, newRole);

  return res.status(200).json(
    new ApiResponse(
      200,
      updatedMember,
      "Project member role updated successfully"
    )
  );
});

export const deleteMember = asyncHandler(async (req, res) => {
  const { projectId, memberId } = req.params;
  const requesterId = req.user.id;

  const removedUser = await deleteMemberService(projectId, memberId, requesterId);

  return res.status(200).json(
    new ApiResponse(200, { removedUser }, "Member removed successfully")
  );
});