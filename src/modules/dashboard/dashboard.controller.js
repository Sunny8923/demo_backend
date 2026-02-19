const dashboardService = require("./dashboard.service");

// ADMIN DASHBOARD
async function getAdminDashboard(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const dashboard = await dashboardService.getAdminDashboard();

    return res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard",
    });
  }
}

// PARTNER DASHBOARD
async function getPartnerDashboard(req, res) {
  try {
    if (req.user.role !== "PARTNER") {
      return res.status(403).json({
        success: false,
        message: "Partner access required",
      });
    }

    const partnerId = req.partner.id;

    const dashboard = await dashboardService.getPartnerDashboard(partnerId);

    return res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Partner dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch partner dashboard",
    });
  }
}

// USER DASHBOARD
async function getUserDashboard(req, res) {
  try {
    if (req.user.role !== "USER") {
      return res.status(403).json({
        success: false,
        message: "User access required",
      });
    }

    const userId = req.user.id; // FIXED

    const dashboard = await dashboardService.getUserDashboard(userId);

    return res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("User dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user dashboard",
    });
  }
}

module.exports = {
  getAdminDashboard,
  getPartnerDashboard,
  getUserDashboard,
};
