import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

// Register connection event listeners once globally to prevent listener accumulation and duplicate logs
mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
mongoose.connection.on("error", (err) => logger.error("MongoDB error", { err }));
mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

export const connectDB = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If currently connecting, wait for connection to complete
  if (mongoose.connection.readyState === 2) {
    logger.info("MongoDB connection is in progress, waiting...");
    return new Promise((resolve, reject) => {
      const onConnected = () => {
        mongoose.connection.off("error", onError);
        resolve(mongoose.connection);
      };
      const onError = (err) => {
        mongoose.connection.off("connected", onConnected);
        reject(err);
      };
      mongoose.connection.once("connected", onConnected);
      mongoose.connection.once("error", onError);
    });
  }

  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      return mongoose.connection;
    } catch (err) {
      retries -= 1;
      logger.error(`MongoDB connection failed, retries left: ${retries}`, { err });
      if (retries === 0) {
        logger.error("Could not connect to MongoDB after maximum retries.");
        throw err;
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected gracefully");
};
