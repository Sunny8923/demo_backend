const express = require("express");
const router = express.Router();

const adminDashboardController = require("./adminDashboard.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

////////////////////////////////////////////////////////////
/// ADMIN DASHBOARD ROUTES
////////////////////////////////////////////////////////////

router.get(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  adminDashboardController.getAdminDashboard,
);

module.exports = router;
