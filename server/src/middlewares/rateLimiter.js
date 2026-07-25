import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const buildLimiter = (max, windowMs, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new ApiError(429, message));
    },
  });

export const defaultLimiter = buildLimiter(
  parseInt(env.RATE_LIMIT_MAX),
  parseInt(env.RATE_LIMIT_WINDOW_MS),
  "Too many requests, please try again later"
);

export const authLimiter = buildLimiter(10, 15 * 60 * 1000, "Too many auth attempts");

export const ingestionLimiter = buildLimiter(
  parseInt(env.INGESTION_RATE_LIMIT_MAX),
  60 * 60 * 1000,
  "Ingestion rate limit exceeded"
);

export const chatLimiter = buildLimiter(30, 60 * 1000, "Chat rate limit exceeded");
