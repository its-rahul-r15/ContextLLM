import { User } from "./user.model.js";
import { ApiError } from "../../utils/ApiError.js";

export const getProfile = async (userId) => {
  const user = await User.findById(userId).select("-passwordHash -refreshToken -googleId");
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

export const updateProfile = async (userId, updates) => {
  const allowed = ["displayName", "avatarUrl"];
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
    new: true,
    runValidators: true,
  }).select("-passwordHash -refreshToken -googleId");

  if (!user) throw new ApiError(404, "User not found");
  return user;
};
