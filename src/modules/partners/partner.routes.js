const express = require("express");
const router = express.Router();

const partnerController = require("./partner.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/requireRole.middleware");
const requirePartnerApproved = require("../../middlewares/requirePartnerApproved.middleware");

// PUBLIC: Partner signup
router.post("/signup", partnerController.signupPartner);

// ADMIN: Get pending partner requests
router.get(
  "/pending",
  authMiddleware,
  requireRole("ADMIN"),
  partnerController.getPendingRequests,
);

// ADMIN: Approve partner
router.patch(
  "/:partnerId/approve",
  authMiddleware,
  requireRole("ADMIN"),
  partnerController.approvePartnerRequest,
);

// ADMIN: Reject partner
router.patch(
  "/:partnerId/reject",
  authMiddleware,
  requireRole("ADMIN"),
  partnerController.rejectPartnerRequest,
);

// PARTNER: Get own profile (ONLY APPROVED partners)
router.get(
  "/me",
  authMiddleware,
  requireRole("PARTNER"),
  requirePartnerApproved,
  partnerController.getMyProfile,
);

module.exports = router;
