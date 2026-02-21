const express = require("express");
const router = express.Router();

const recruiterDashboardController = require("./recruiterDashboard.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

////////////////////////////////////////////////////////////
/// RECRUITER DASHBOARD ROUTES
////////////////////////////////////////////////////////////

router.get(
  "/",
  authMiddleware,
  requireRole("RECRUITER"),
  recruiterDashboardController.getRecruiterDashboard,
);

module.exports = router;
