const adminDashboardService = require("./adminDashboard.service");

////////////////////////////////////////////////////////////
/// ADMIN DASHBOARD CONTROLLER
////////////////////////////////////////////////////////////

async function getAdminDashboard(req, res) {
  try {
    const range = req.query.range || "7d";

    const dashboard = await adminDashboardService.getAdminDashboard(range);

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

module.exports = {
  getAdminDashboard,
};
