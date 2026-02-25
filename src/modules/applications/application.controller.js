const applicationService = require("./application.service");
const prisma = require("../../config/prisma");

////////////////////////////////////////////////////////
// APPLY TO JOB
////////////////////////////////////////////////////////

async function applyToJob(req, res) {
  try {
    const { jobId, candidate } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required",
      });
    }

    if (!candidate) {
      return res.status(400).json({
        success: false,
        message: "candidate object is required",
      });
    }

    if (!candidate.name || !candidate.email || !candidate.phone) {
      return res.status(400).json({
        success: false,
        message: "candidate name, email and phone are required",
      });
    }

    //////////////////////////////////////////////////////
    // DETERMINE OWNER
    //////////////////////////////////////////////////////

    let userId = null;
    let partnerId = null;

    if (req.user.role === "PARTNER") {
      const partner = await prisma.partner.findUnique({
        where: {
          userId: req.user.userId,
        },
      });

      if (!partner) {
        return res.status(400).json({
          success: false,
          message: "Partner profile not found for this user",
        });
      }

      partnerId = partner.id;
    } else {
      userId = req.user.userId;
    }

    //////////////////////////////////////////////////////
    // SERVICE CALL
    //////////////////////////////////////////////////////

    const application = await applicationService.applyToJob({
      jobId,
      candidateData: candidate,
      userId,
      partnerId,
      role: req.user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  } catch (error) {
    console.error("Apply error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to apply",
    });
  }
}

////////////////////////////////////////////////////////
// GET MY APPLICATIONS
////////////////////////////////////////////////////////

async function getMyApplications(req, res) {
  try {
    let partnerId = null;

    if (req.user.role === "PARTNER") {
      const partner = await prisma.partner.findUnique({
        where: {
          userId: req.user.userId,
        },
      });

      if (!partner) {
        return res.status(400).json({
          success: false,
          message: "Partner profile not found",
        });
      }

      partnerId = partner.id;
    }

    const applications = await applicationService.getMyApplications({
      userId: req.user.userId,
      role: req.user.role,
      partnerId,
    });

    return res.json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (error) {
    console.error("Get my applications error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch applications",
    });
  }
}

////////////////////////////////////////////////////////
// GET ALL APPLICATIONS (ADMIN)
////////////////////////////////////////////////////////

async function getAllApplications(req, res) {
  try {
    const applications = await applicationService.getAllApplications();

    return res.json({
      success: true,

      count: applications.length,

      data: applications,
    });
  } catch (error) {
    console.error("Get all applications error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to fetch applications",
    });
  }
}

////////////////////////////////////////////////////////
// UPDATE APPLICATION STATUS
////////////////////////////////////////////////////////

async function updateApplicationStatus(req, res) {
  try {
    const { id } = req.params;

    const { pipelineStage } = req.body;

    if (!pipelineStage) {
      return res.status(400).json({
        success: false,

        message: "pipelineStage is required",
      });
    }

    const application = await applicationService.updateApplicationStatus(
      id,

      pipelineStage,
    );

    return res.json({
      success: true,

      message: "Application status updated successfully",

      data: application,
    });
  } catch (error) {
    console.error("Update application error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to update application",
    });
  }
}

////////////////////////////////////////////////////////

module.exports = {
  applyToJob,

  getMyApplications,

  getAllApplications,

  updateApplicationStatus,
};
