const express = require("express");
const router = express.Router();

const jobController = require("./job.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/requireRole.middleware");
const upload = require("../../middlewares/upload.middleware");
const uploadResume = require("../../middlewares/uploadResume.middleware");

////////////////////////////////////////////////////////
// CREATE JOB
////////////////////////////////////////////////////////

router.post("/", authMiddleware, requireRole("ADMIN"), jobController.createJob);

////////////////////////////////////////////////////////
// GET ALL JOBS
////////////////////////////////////////////////////////

router.get("/", authMiddleware, jobController.getAllJobs);

////////////////////////////////////////////////////////
// CSV UPLOAD (MUST BE BEFORE :id)
////////////////////////////////////////////////////////

router.post(
  "/upload-csv",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  jobController.uploadJobsCSV,
);

router.post(
  "/parse-jd",
  authMiddleware,
  requireRole("ADMIN"),
  uploadResume.array("files"),
  jobController.parseJobJDs,
);

////////////////////////////////////////////////////////
// CREATE JOBS FROM JD (AFTER APPROVAL)
////////////////////////////////////////////////////////

router.post(
  "/create-from-jd",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.createJobsFromJD,
);

router.get(
  "/:id/match",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.matchCandidates,
);

////////////////////////////////////////////////////////
// GET JOB BY ID (MUST BE AFTER upload-csv)
////////////////////////////////////////////////////////

router.get("/:id", authMiddleware, jobController.getJobById);

////////////////////////////////////////////////////////
// UPDATE JOB
////////////////////////////////////////////////////////

router.patch(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.updateJob,
);

////////////////////////////////////////////////////////
// DELETE JOB
////////////////////////////////////////////////////////

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.deleteJob,
);

module.exports = router;
