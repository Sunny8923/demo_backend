const express = require("express");
const router = express.Router();

const applicationController = require("./application.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/requireRole.middleware");
const requirePartnerApproved = require("../../middlewares/requirePartnerApproved.middleware");

router.post(
  "/apply",
  authMiddleware,
  requireRole("USER", "PARTNER"),
  requirePartnerApproved,
  applicationController.applyToJob,
);

router.get(
  "/my",
  authMiddleware,
  requireRole("USER", "PARTNER"),
  requirePartnerApproved,
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
