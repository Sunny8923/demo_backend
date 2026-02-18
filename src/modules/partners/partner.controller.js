const partnerService = require("./partner.service");

// UPDATED: Partner Signup
async function signupPartner(req, res) {
  try {
    const {
      name,
      email,
      password,

      organisationName,
      ownerName,
      establishmentDate,

      gstNumber,
      panNumber,

      msmeRegistered,

      address,

      contactNumber,

      officialEmail,
    } = req.body;

    // validation
    if (
      !name ||
      !email ||
      !password ||
      !organisationName ||
      !ownerName ||
      !establishmentDate ||
      !gstNumber ||
      !panNumber ||
      !address ||
      !contactNumber ||
      !officialEmail
    ) {
      return res.status(400).json({
        message:
          "All fields are required: name, email, password, organisationName, ownerName, establishmentDate, gstNumber, panNumber, address, contactNumber, officialEmail",
      });
    }

    const result = await partnerService.createPartnerSignup({
      name,
      email,
      password,

      organisationName,
      ownerName,
      establishmentDate,

      gstNumber,
      panNumber,

      msmeRegistered,

      address,

      contactNumber,

      officialEmail,
    });

    res.status(201).json({
      message: "Partner signup successful. Waiting for admin approval.",

      user: result.user,

      partner: result.partner,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

// Admin: get pending partner requests
async function getPendingRequests(req, res) {
  try {
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

// Admin: approve partner
async function approvePartnerRequest(req, res) {
  try {
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

// Admin: reject partner
async function rejectPartnerRequest(req, res) {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admin can reject partner requests",
      });
    }

    const { partnerId } = req.params;

    const partner = await partnerService.rejectPartnerRequest(partnerId);

    res.json({
      message: "Partner rejected successfully",
      partner,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
}

async function getMyProfile(req, res) {
  try {
    const partner = await partnerService.getMyPartnerProfile(req.user.userId);

    res.json({
      partner,
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
}

module.exports = {
  signupPartner,
  getPendingRequests,
  approvePartnerRequest,
  getMyProfile,
  rejectPartnerRequest,
};
