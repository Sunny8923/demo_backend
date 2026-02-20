const partnerDashboardService = require("./partnerDashboard.service");

////////////////////////////////////////////////////////////
/// PARTNER DASHBOARD CONTROLLER
////////////////////////////////////////////////////////////

async function getPartnerDashboard(req, res) {
  try {
    // partner is attached by auth middleware + requirePartnerApproved
    const partnerId = req.partner.id;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "Partner ID not found",
      });
    }

    //////////////////////////////////////////////////////
    // GET RANGE FROM QUERY (NEW)
    //////////////////////////////////////////////////////

    const range = req.query.range || "7d";

    //////////////////////////////////////////////////////
    // CALL SERVICE WITH RANGE
    //////////////////////////////////////////////////////

    const dashboard = await partnerDashboardService.getPartnerDashboard(
      partnerId,
      range,
    );

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

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

module.exports = {
  getPartnerDashboard,
};
