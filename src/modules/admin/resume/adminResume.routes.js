const express = require("express");
const router = express.Router();

const adminResumeController = require("./adminResume.controller");
const jobController = require("./controllers/jobStatus.controller"); // 👈 ADD THIS

const authMiddleware = require("../../../middlewares/auth.middleware");
const requireRole = require("../../../middlewares/requireRole.middleware");
const uploadResume = require("../../../middlewares/uploadResume.middleware");

////////////////////////////////////////////////////////////
/// UPLOAD RESUMES
////////////////////////////////////////////////////////////

router.post(
  "/upload",
  authMiddleware,
  requireRole("ADMIN"),
  uploadResume.any(),
  adminResumeController.uploadResumes,
);

////////////////////////////////////////////////////////////
/// JOB STATUS (TRACK PROGRESS)
////////////////////////////////////////////////////////////

router.get(
  "/job/:jobId",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.getJobStatus,
);

module.exports = router;
