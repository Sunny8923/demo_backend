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

module.exports = router;
