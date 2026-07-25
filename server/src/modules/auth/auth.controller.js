import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as authService from "./auth.service.js";
import { registerSchema, loginSchema, refreshSchema } from "./auth.validation.js";

export const register = asyncHandler(async (req, res) => {
  const body = registerSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(422, "Validation failed", body.error.errors);

  const result = await authService.register(body.data);
  new ApiResponse(201, "Registered successfully", result).send(res);
});

export const login = asyncHandler(async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(422, "Validation failed", body.error.errors);

  const result = await authService.login(body.data);
  new ApiResponse(200, "Login successful", result).send(res);
});

export const refresh = asyncHandler(async (req, res) => {
  const body = refreshSchema.safeParse(req.body);
  if (!body.success) throw new ApiError(422, "Validation failed", body.error.errors);

  const result = await authService.refreshTokens(body.data.refreshToken);
  new ApiResponse(200, "Tokens refreshed", result).send(res);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  new ApiResponse(200, "Logged out successfully").send(res);
});
