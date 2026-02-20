const express = require("express");
const router = express.Router();

const jobController = require("./job.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/requireRole.middleware");
const upload = require("../../middlewares/upload.middleware");

////////////////////////////////////////////////////////
// CREATE JOB (ADMIN ONLY)
////////////////////////////////////////////////////////

router.post("/", authMiddleware, requireRole("ADMIN"), jobController.createJob);

////////////////////////////////////////////////////////
// GET ALL JOBS
////////////////////////////////////////////////////////

router.get("/", authMiddleware, jobController.getAllJobs);

////////////////////////////////////////////////////////
// CSV UPLOAD (ADMIN ONLY)
////////////////////////////////////////////////////////

router.post(
  "/upload-csv",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  jobController.uploadJobsCSV,
);

////////////////////////////////////////////////////////
// GET JOB BY ID
////////////////////////////////////////////////////////

router.get("/:id", authMiddleware, jobController.getJobById);

////////////////////////////////////////////////////////
// UPDATE JOB (ADMIN ONLY)
////////////////////////////////////////////////////////

router.patch(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.updateJob,
);

////////////////////////////////////////////////////////
// DELETE JOB (ADMIN ONLY)
////////////////////////////////////////////////////////

router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.deleteJob,
);

module.exports = router;
