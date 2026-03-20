const jobService = require("./job.service");
const jobJDProcessor = require("./services/job.jd.processor"); // new
const prisma = require("../../config/prisma");
const jobMatchingService = require("./services/jobMatching.service");
const { uploadToR2 } = require("../../utils/uploadToR2");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

////////////////////////////////////////////////////////
// CREATE JOB (ADMIN)
////////////////////////////////////////////////////////

async function createJob(req, res) {
  try {
    const {
      jrCode,
      title,
      description,
      jd,
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
    // VALIDATION (FIXED)
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
      jd,
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
      source: jd ? "JD_UPLOAD" : "MANUAL",
      requestDate,
      closureDate,
      createdById: req.user.userId,
    });

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
// CREATE JOBS FROM JD (APPROVED AFTER PREVIEW)
////////////////////////////////////////////////////////

async function createJobsFromJD(req, res) {
  try {
    const { jobs } = req.body;

    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Jobs array is required",
      });
    }

    //////////////////////////////////////////////////////
    // PROCESS JOBS
    //////////////////////////////////////////////////////

    const results = [];

    const seen = new Set();

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      try {
        //////////////////////////////////////////////////////
        // BASIC VALIDATION
        //////////////////////////////////////////////////////

        if (!job.title || !job.companyName || !job.location) {
          results.push({
            index: i,
            status: "skipped",
            error: "Missing required fields",
          });
          continue;
        }

        //////////////////////////////////////////////////////
        // NORMALIZE KEY (for duplicate detection)
        //////////////////////////////////////////////////////

        const key = `${job.title}-${job.companyName}-${job.location}`
          .toLowerCase()
          .trim();

        //////////////////////////////////////////////////////
        // DUPLICATE IN SAME REQUEST
        //////////////////////////////////////////////////////

        if (seen.has(key)) {
          results.push({
            index: i,
            status: "skipped",
            error: "Duplicate in request",
          });
          continue;
        }

        seen.add(key);

        //////////////////////////////////////////////////////
        // DUPLICATE IN DATABASE
        //////////////////////////////////////////////////////

        const existing = await prisma.job.findFirst({
          where: {
            title: job.title,
            companyName: job.companyName,
            location: job.location,
          },
        });

        if (existing) {
          results.push({
            index: i,
            status: "skipped",
            error: "Duplicate job in database",
          });
          continue;
        }
        //////////////////////////////////////////////////////
        // CREATE JOB
        //////////////////////////////////////////////////////

        const created = await jobService.createJob({
          ...job,

          // fallback defaults
          openings: job.openings || 1,
          status: job.status || "OPEN",

          source: "JD_UPLOAD",
          createdById: req.user.userId,
        });

        results.push({
          index: i,
          status: "created",
          jobId: created.id,
        });
      } catch (err) {
        results.push({
          index: i,
          status: "error",
          error: err.message,
        });
      }
    }

    //////////////////////////////////////////////////////
    // SUMMARY
    //////////////////////////////////////////////////////

    const summary = {
      total: jobs.length,
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "error").length,
    };

    return res.json({
      success: true,
      message: "JD jobs processed",
      summary,
      results,
    });
  } catch (error) {
    console.error("CreateJobsFromJD error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create jobs from JD",
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

async function downloadToTempFile(url, fileName) {
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);

  const res = await axios.get(url, { responseType: "stream" });

  const writer = fs.createWriteStream(tempPath);

  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return tempPath;
}

async function uploadJobsCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    //////////////////////////////////////////////////////
    // UPLOAD TO R2
    //////////////////////////////////////////////////////
    const r2Url = await uploadToR2(req.file);

    if (!r2Url) {
      return res.status(500).json({
        success: false,
        message: "CSV upload failed",
      });
    }

    //////////////////////////////////////////////////////
    // DOWNLOAD TO TEMP
    //////////////////////////////////////////////////////
    const tempPath = await downloadToTempFile(r2Url, req.file.originalname);

    //////////////////////////////////////////////////////
    // SAME LOGIC (UNCHANGED)
    //////////////////////////////////////////////////////
    const result = await jobService.createJobsFromCSV(
      tempPath,
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
// PARSE JOB JD (NO DB WRITE)
////////////////////////////////////////////////////////

async function parseJobJDs(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one JD file is required",
      });
    }

    const result = await jobJDProcessor.processJobJDs(req.files);

    return res.json({
      success: true,
      message: "JDs parsed successfully",
      ...result,
    });
  } catch (error) {
    console.error("JD parse error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "JD parsing failed",
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
// MATCH CANDIDATES
////////////////////////////////////////////////////////

async function matchCandidates(req, res) {
  try {
    const { id } = req.params;

    const results = await jobMatchingService.matchCandidatesToJob(id);

    return res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Matching error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Matching failed",
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
  parseJobJDs,
  createJobsFromJD,
  matchCandidates,
};
