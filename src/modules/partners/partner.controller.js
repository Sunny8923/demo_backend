const partnerService = require("./partner.service");

async function createPartnerRequest(req, res) {
  try {
    const { businessName, phone } = req.body;

    if (!businessName || !phone) {
      return res.status(400).json({
        message: "Business name and phone required",
      });
    }

    const partner = await partnerService.createPartnerRequest({
      userId: req.user.userId,
      businessName,
      phone,
    });

    res.status(201).json({
      message: "Partner request submitted",
      partner,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

async function getPendingRequests(req, res) {
  try {
    // admin only
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can view partner requests",
      });
    }

    const requests = await partnerService.getPendingRequests();

    res.json({
      requests,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

async function approvePartnerRequest(req, res) {
  try {
    // admin only
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can approve partner requests",
      });
    }

    const { partnerId } = req.params;

    const partner = await partnerService.approvePartnerRequest(partnerId);

    res.json({
      message: "Partner approved successfully",
      partner,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = {
  createPartnerRequest,
  getPendingRequests,
  approvePartnerRequest,
};
