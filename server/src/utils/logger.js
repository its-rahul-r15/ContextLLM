import winston from "winston";
import { env } from "../config/env.js";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const transports = [];

if (env.NODE_ENV !== "production") {
  transports.push(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports,
  exitOnError: false,
});
