const express = require("express");
const router = express.Router();

const recruiterController = require("./adminRecruiter.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");

////////////////////////////////////////////////////////////
/// ADMIN RECRUITER ROUTES
////////////////////////////////////////////////////////////

// Create recruiter
router.post(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  recruiterController.createRecruiter,
);

////////////////////////////////////////////////////////////

module.exports = router;
