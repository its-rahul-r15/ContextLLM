import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../users/user.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";

export const generateTokens = (user) => {
  const payload = { _id: user._id, email: user.email, role: user.role };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ _id: user._id }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

export const register = async ({ email, password, displayName }) => {
  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, displayName });

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  return { user: user.toSafeObject(), accessToken, refreshToken };
};

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, "Invalid credentials");

  const valid = await user.comparePassword(password);
  if (!valid) throw new ApiError(401, "Invalid credentials");

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  return { user: user.toSafeObject(), accessToken, refreshToken };
};

export const refreshTokens = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(payload._id);
  if (!user || user.refreshToken !== token) {
    throw new ApiError(401, "Refresh token reuse detected");
  }

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};

export const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

export const handleGoogleCallback = async (profile) => {
  const email = profile.emails?.[0]?.value;
  const avatarUrl = profile.photos?.[0]?.value || null;
  const displayName = profile.displayName || email;

  let user = await User.findOne({ googleId: profile.id });

  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      user.googleId = profile.id;
      user.avatarUrl = avatarUrl;
      await user.save();
    } else {
      user = await User.create({
        email,
        googleId: profile.id,
        avatarUrl,
        displayName,
      });
    }
  }

  const { accessToken, refreshToken } = generateTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  return { user: user.toSafeObject(), accessToken, refreshToken };
};
