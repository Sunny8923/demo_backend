const express = require("express");
const router = express.Router();

const partnerController = require("./partner.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

// submit partner request
router.post("/request", authMiddleware, partnerController.createPartnerRequest);
// get pending requests (admin only)
router.get("/pending", authMiddleware, partnerController.getPendingRequests);

// approve request (admin only)
router.post(
  "/:partnerId/approve",
  authMiddleware,
  partnerController.approvePartnerRequest,
);

module.exports = router;
