import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { 
  registerUserService, 
  loginService, 
  logoutUserService,
  refreshAccessTokenService,
  changeCurrentPasswordService,
  deleteAccountService
} from "../services/auth.services.js";
import { cookieOptions } from "../utils/cookieConfig.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { email, username, password, fullName } = req.body;

  const user = await registerUserService({ email, username, password, fullName });

  return res.status(201).json(
    new ApiResponse(
      201,
      { user },
      "User registered successfully"
    )
  );
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const { safeUser, accessToken, refreshToken } = await loginService({ identifier, password });

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: safeUser },
        "User logged in successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  await logoutUserService(req.user.id);

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(200, req.user, "Current user fetched successfully")
    );
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken;

  const { accessToken, refreshToken } = await refreshAccessTokenService(incomingRefreshToken);

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(200, {}, "Access token refreshed")
    );
});


export const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  await changeCurrentPasswordService(req.user.id, { oldPassword, newPassword });

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

export const deleteAccount = asyncHandler(async (req, res) => {
  await deleteAccountService(req.user.id);

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(
      new ApiResponse(200, {}, "Account deleted successfully")
    );
});

export {
  registerUser,
  login,
  logoutUser,
  getCurrentUser,
  refreshAccessToken,
  changeCurrentPassword,
  deleteAccount,
};
