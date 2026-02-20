const userDashboardService = require("./userDashboard.service");

async function getUserDashboard(req, res) {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found",
      });
    }

    const range = req.query.range || "7d";

    const dashboard = await userDashboardService.getUserDashboard(
      userId,
      range,
    );

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
  getUserDashboard,
};
