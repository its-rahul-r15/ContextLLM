import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";

import { requestLogger } from "./middlewares/requestLogger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { defaultLimiter } from "./middlewares/rateLimiter.js";

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import notebookRoutes from "./modules/notebooks/notebook.routes.js";
import sourceRoutes from "./modules/sources/source.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import noteRoutes from "./modules/notes/note.routes.js";

import { env } from "./config/env.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(passport.initialize());

app.use(defaultLimiter);

app.use("/uploads", express.static("uploads"));

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notebooks", notebookRoutes);
app.use("/api/notebooks/:nid/sources", sourceRoutes);
app.use("/api/notebooks/:nid/notes", noteRoutes);
app.use("/api", chatRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

app.use(errorHandler);

export default app;
