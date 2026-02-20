const express = require("express");
const router = express.Router();

const userDashboardController = require("./userDashboard.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

////////////////////////////////////////////////////////////
/// USER DASHBOARD ROUTES
////////////////////////////////////////////////////////////

router.get(
  "/",
  authMiddleware,
  requireRole("USER"),
  userDashboardController.getUserDashboard,
);

module.exports = router;
