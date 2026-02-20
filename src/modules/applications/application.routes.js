const express = require("express");
const router = express.Router();

const applicationController = require("./application.controller");

const authMiddleware = require("../../middlewares/auth.middleware");

const requireRole = require("../../middlewares/requireRole.middleware");

router.post(
  "/apply",
  authMiddleware,
  requireRole("USER", "PARTNER"),
  applicationController.applyToJob,
);

router.get(
  "/my",
  authMiddleware,
  requireRole("USER", "PARTNER"),
  applicationController.getMyApplications,
);

router.get(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  applicationController.getAllApplications,
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("ADMIN"),
  applicationController.updateApplicationStatus,
);

module.exports = router;
