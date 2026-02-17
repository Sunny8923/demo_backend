const applicationService = require("./application.service");

async function applyToJob(req, res) {
  try {
    const { jobId, name, email, phone } = req.body;

    if (!jobId || !name || !email || !phone) {
      return res.status(400).json({
        message: "jobId, name, email and phone are required",
      });
    }

    const application = await applicationService.applyToJob({
      jobId,
      candidateName: name,
      candidateEmail: email,
      candidatePhone: phone,
      userId: req.user.userId,
      role: req.user.role,
    });

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

async function getMyApplications(req, res) {
  try {
    const applications = await applicationService.getMyApplications({
      userId: req.user.userId,
      role: req.user.role,
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

async function getAllApplications(req, res) {
  try {
    // only admin allowed
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can view all applications",
      });
    }

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

module.exports = {
  applyToJob,
  getMyApplications,
  getAllApplications,
};
