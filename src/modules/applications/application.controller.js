const applicationService = require("./application.service");

////////////////////////////////////////////////////////
/// APPLY TO JOB (UPGRADED FOR FULL CANDIDATE PROFILE)
////////////////////////////////////////////////////////

async function applyToJob(req, res) {
  try {
    const { jobId, candidate } = req.body;

    //////////////////////////////////////////////////////
    // Validation
    //////////////////////////////////////////////////////

    if (!jobId) {
      return res.status(400).json({
        message: "jobId is required",
      });
    }

    if (!candidate) {
      return res.status(400).json({
        message: "candidate object is required",
      });
    }

    if (!candidate.name || !candidate.email || !candidate.phone) {
      return res.status(400).json({
        message: "candidate name, email and phone are required",
      });
    }

    //////////////////////////////////////////////////////
    // Call service with FULL candidate profile
    //////////////////////////////////////////////////////

    const application = await applicationService.applyToJob({
      jobId,

      candidateData: candidate,

      userId: req.user.userId,

      role: req.user.role,

      partnerId: req.partner?.id || null,
    });

    //////////////////////////////////////////////////////
    // Success response
    //////////////////////////////////////////////////////

    res.status(201).json({
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
/// GET MY APPLICATIONS
////////////////////////////////////////////////////////

async function getMyApplications(req, res) {
  try {
    const applications = await applicationService.getMyApplications({
      userId: req.user.userId,
      role: req.user.role,
      partnerId: req.partner?.id || null,
    });

    res.json({
      applications,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
/// GET ALL APPLICATIONS (ADMIN)
////////////////////////////////////////////////////////

async function getAllApplications(req, res) {
  try {
    const applications = await applicationService.getAllApplications();

    res.json({
      applications,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
/// UPDATE APPLICATION PIPELINE STAGE (ADMIN)
////////////////////////////////////////////////////////

async function updateApplicationStatus(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can update application status",
      });
    }

    const { id } = req.params;

    const { pipelineStage } = req.body;

    if (!pipelineStage) {
      return res.status(400).json({
        message: "pipelineStage is required",
      });
    }

    const application = await applicationService.updateApplicationStatus(
      id,
      pipelineStage,
    );

    res.json({
      message: "Application status updated successfully",
      application,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
/// EXPORTS
////////////////////////////////////////////////////////

module.exports = {
  applyToJob,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus,
};
