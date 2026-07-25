import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

let retries = 5;

export const connectDB = async () => {
  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error("MongoDB error", { err }));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  while (retries > 0) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      return;
    } catch (err) {
      retries -= 1;
      logger.error(`MongoDB connection failed, retries left: ${retries}`, { err });
      if (retries === 0) {
        logger.error("Could not connect to MongoDB. Exiting.");
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected gracefully");
};
