const express = require("express");
const router = express.Router();

const jobController = require("./job.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/requireRole.middleware");
const upload = require("../../middlewares/upload.middleware");

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
