const express = require("express");
const router = express.Router();

const jobController = require("./job.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");
// create job (admin only)
router.post("/", authMiddleware, jobController.createJob);

// get all jobs (logged in users)
router.get("/", authMiddleware, jobController.getAllJobs);
// upload CSV (admin only)
router.post(
  "/upload-csv",
  authMiddleware,
  upload.single("file"),
  jobController.uploadJobsCSV,
);

router.get("/:id", authMiddleware, jobController.getJobById);
// UPDATE JOB
router.patch(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.updateJob,
);

// DELETE JOB
router.delete(
  "/:id",
  authMiddleware,
  requireRole("ADMIN"),
  jobController.deleteJob,
);

module.exports = router;
