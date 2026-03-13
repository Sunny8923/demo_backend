const express = require("express");
const router = express.Router();

const adminResumeController = require("./adminResume.controller");

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");
const uploadResume = require("../../../middlewares/uploadResume.middleware");

////////////////////////////////////////////////////////////
/// ADMIN RESUME ROUTES
////////////////////////////////////////////////////////////

router.post(
  "/upload",
  authMiddleware,
  requireRole("ADMIN"),
  uploadResume.array("resumes", 50),
  adminResumeController.uploadResumes,
);

module.exports = router;
