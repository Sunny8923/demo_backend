const express = require("express");
const router = express.Router();

const partnerDashboardController = require("./partnerDashboard.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");
const requirePartnerApproved = require("../../../middlewares/requirePartnerApproved.middleware");

////////////////////////////////////////////////////////////
/// PARTNER DASHBOARD ROUTES
////////////////////////////////////////////////////////////

router.get(
  "/",
  authMiddleware,
  requireRole("PARTNER"),
  requirePartnerApproved,
  partnerDashboardController.getPartnerDashboard,
);

module.exports = router;
