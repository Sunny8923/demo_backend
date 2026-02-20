const jobService = require("./job.service");

////////////////////////////////////////////////////////
// CREATE JOB (ADMIN)
////////////////////////////////////////////////////////

async function createJob(req, res) {
  try {
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

    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    if (!title || !companyName || !location) {
      return res.status(400).json({
        success: false,
        message: "title, companyName and location are required",
      });
    }

    //////////////////////////////////////////////////////
    // CREATE JOB
    //////////////////////////////////////////////////////

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

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    return res.status(201).json({
      success: true,

      message: "Job created successfully",

      data: job,
    });
  } catch (error) {
    console.error("Create job error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to create job",
    });
  }
}

////////////////////////////////////////////////////////
// GET ALL JOBS
////////////////////////////////////////////////////////

async function getAllJobs(req, res) {
  try {
    const jobs = await jobService.getAllJobs();

    return res.json({
      success: true,

      count: jobs.length,

      data: jobs,
    });
  } catch (error) {
    console.error("Get jobs error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to fetch jobs",
    });
  }
}

////////////////////////////////////////////////////////
// GET JOB BY ID
////////////////////////////////////////////////////////

async function getJobById(req, res) {
  try {
    const { id } = req.params;

    const job = await jobService.getJobById(id);

    return res.json({
      success: true,

      data: job,
    });
  } catch (error) {
    console.error("Get job error:", error);

    if (error.message === "Job not found") {
      return res.status(404).json({
        success: false,

        message: "Job not found",
      });
    }

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to fetch job",
    });
  }
}

////////////////////////////////////////////////////////
// CSV UPLOAD
////////////////////////////////////////////////////////

async function uploadJobsCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,

        message: "CSV file is required",
      });
    }

    const result = await jobService.createJobsFromCSV(
      req.file.path,

      req.user.userId,
    );

    return res.json({
      success: result.success,

      message: result.success
        ? "CSV uploaded successfully"
        : "CSV upload completed with issues",

      summary: result.summary,

      errors: result.errors,
    });
  } catch (error) {
    console.error("CSV upload error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "CSV upload failed",
    });
  }
}

////////////////////////////////////////////////////////
// UPDATE JOB
////////////////////////////////////////////////////////

async function updateJob(req, res) {
  try {
    const { id } = req.params;

    const updatedJob = await jobService.updateJob(id, req.body);

    return res.json({
      success: true,

      message: "Job updated successfully",

      data: updatedJob,
    });
  } catch (error) {
    console.error("Update job error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to update job",
    });
  }
}

////////////////////////////////////////////////////////
// DELETE JOB
////////////////////////////////////////////////////////

async function deleteJob(req, res) {
  try {
    const { id } = req.params;

    await jobService.deleteJob(id);

    return res.json({
      success: true,

      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to delete job",
    });
  }
}

////////////////////////////////////////////////////////

module.exports = {
  createJob,
  getAllJobs,
  uploadJobsCSV,
  getJobById,
  updateJob,
  deleteJob,
};
