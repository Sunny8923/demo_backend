const recruiterDashboardService = require("./recruiterDashboard.service");

////////////////////////////////////////////////////////////
/// GET RECRUITER DASHBOARD
////////////////////////////////////////////////////////////

async function getRecruiterDashboard(req, res) {
  try {
    const recruiterId = req.user.userId;

    const dashboard =
      await recruiterDashboardService.getRecruiterDashboard(recruiterId);

    return res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Recruiter dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch recruiter dashboard",
    });
  }
}

////////////////////////////////////////////////////////////

module.exports = {
  getRecruiterDashboard,
};
