const dashboardService = require("./dashboard.service");

// ADMIN DASHBOARD
async function getAdminDashboard(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    const dashboard = await dashboardService.getAdminDashboard();

    res.json({
      dashboard,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

// PARTNER DASHBOARD
async function getPartnerDashboard(req, res) {
  try {
    if (req.user.role !== "PARTNER") {
      return res.status(403).json({
        message: "Partner access required",
      });
    }

    // partner id is available from middleware
    const partnerId = req.partner.id;

    const dashboard = await dashboardService.getPartnerDashboard(partnerId);

    res.json({
      dashboard,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

// USER DASHBOARD
async function getUserDashboard(req, res) {
  try {
    if (req.user.role !== "USER") {
      return res.status(403).json({
        message: "User access required",
      });
    }

    const userId = req.user.userId;

    const dashboard = await dashboardService.getUserDashboard(userId);

    res.json({
      dashboard,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = {
  getAdminDashboard,
  getPartnerDashboard,
  getUserDashboard,
};
