const express = require("express");
const router = express.Router();

const dashboardController = require("./dashboard.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/requireRole.middleware");
const requirePartnerApproved = require("../../middlewares/requirePartnerApproved.middleware");

// ADMIN dashboard
router.get(
  "/admin",
  authMiddleware,
  requireRole("ADMIN"),
  dashboardController.getAdminDashboard,
);

// PARTNER dashboard
router.get(
  "/partner",
  authMiddleware,
  requireRole("PARTNER"),
  requirePartnerApproved,
  dashboardController.getPartnerDashboard,
);

// USER dashboard
router.get(
  "/user",
  authMiddleware,
  requireRole("USER"),
  dashboardController.getUserDashboard,
);

module.exports = router;
