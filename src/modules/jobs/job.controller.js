const jobService = require("./job.service");

async function createJob(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can create jobs",
      });
    }

    const {
      jrCode,
      title,
      description,
      companyName,
      department,
      location,
      minExperience,
      maxExperience,
      salaryMin,
      salaryMax,
      openings,
      skills,
      education,
      status,
      requestDate,
      closureDate,
    } = req.body;

    if (!title || !companyName || !location) {
      return res.status(400).json({
        message: "title, companyName and location are required",
      });
    }

    const job = await jobService.createJob({
      jrCode,
      title,
      description,
      companyName,
      department,
      location,
      minExperience,
      maxExperience,
      salaryMin,
      salaryMax,
      openings,
      skills,
      education,
      status,
      requestDate,
      closureDate,
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
      count: jobs.length,
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

    const result = await jobService.createJobsFromCSV(
      req.file.path,
      req.user.userId,
    );

    res.json({
      message: result.success
        ? "CSV uploaded successfully"
        : "CSV upload failed",

      summary: result.summary,

      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

async function getJobById(req, res) {
  try {
    const { id } = req.params;

    const job = await jobService.getJobById(id);

    res.json({
      job,
    });
  } catch (error) {
    if (error.message === "Job not found") {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    res.status(500).json({
      message: error.message,
    });
  }
}

// UPDATE JOB (ADMIN)
async function updateJob(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can update jobs",
      });
    }

    const { id } = req.params;

    const updatedJob = await jobService.updateJob(id, req.body);

    res.json({
      message: "Job updated successfully",
      job: updatedJob,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

// DELETE JOB (ADMIN)
async function deleteJob(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can delete jobs",
      });
    }

    const { id } = req.params;

    await jobService.deleteJob(id);

    res.json({
      message: "Job deleted successfully",
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
  getJobById,
  updateJob,
  deleteJob,
};
