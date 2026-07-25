import { Router } from "express";
import passport from "passport";
import * as authController from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";
import { env } from "../../config/env.js";
import "../../modules/auth/auth.google.strategy.js";

const router = Router();

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authenticate, authController.logout);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${env.CLIENT_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const { accessToken, refreshToken } = req.user;
    res.redirect(
      `${env.CLIENT_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
    );
  }
);

export default router;
