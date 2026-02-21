const express = require("express");
const router = express.Router();

const applicationController = require("./application.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/requireRole.middleware");

////////////////////////////////////////////////////////////
/// APPLY TO JOB
/// USER      → apply themselves
/// PARTNER   → submit candidates
/// RECRUITER → submit candidates
////////////////////////////////////////////////////////////

router.post(
  "/apply",
  authMiddleware,
  requireRole("USER", "PARTNER", "RECRUITER"),
  applicationController.applyToJob,
);

////////////////////////////////////////////////////////////
/// GET MY APPLICATIONS
////////////////////////////////////////////////////////////

router.get(
  "/my",
  authMiddleware,
  requireRole("USER", "PARTNER", "RECRUITER"),
  applicationController.getMyApplications,
);

////////////////////////////////////////////////////////////
/// ADMIN: GET ALL APPLICATIONS
////////////////////////////////////////////////////////////

router.get(
  "/",
  authMiddleware,
  requireRole("ADMIN"),
  applicationController.getAllApplications,
);

////////////////////////////////////////////////////////////
/// UPDATE APPLICATION STATUS
/// ADMIN + RECRUITER allowed
////////////////////////////////////////////////////////////

router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("ADMIN", "RECRUITER"),
  applicationController.updateApplicationStatus,
);

////////////////////////////////////////////////////////////

module.exports = router;
