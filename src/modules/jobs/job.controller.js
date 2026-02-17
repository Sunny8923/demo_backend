const jobService = require("./job.service");

async function createJob(req, res) {
  try {
    // check admin role
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can create jobs",
      });
    }

    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        message: "Title and description required",
      });
    }

    const job = await jobService.createJob({
      title,
      description,
      createdById: req.user.userId,
    });

    res.status(201).json({
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

async function getAllJobs(req, res) {
  try {
    const jobs = await jobService.getAllJobs();

    res.json({
      jobs,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

async function uploadJobsCSV(req, res) {
  try {
    // admin only
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can upload CSV",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "CSV file is required",
      });
    }

    const count = await jobService.createJobsFromCSV(
      req.file.path,
      req.user.userId,
    );

    res.json({
      message: `${count} jobs uploaded successfully`,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = {
  createJob,
  getAllJobs,
  uploadJobsCSV,
};
