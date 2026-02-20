const partnerService = require("./partner.service");

////////////////////////////////////////////////////////
// PARTNER SIGNUP
////////////////////////////////////////////////////////

async function signupPartner(req, res) {
  try {
    const data = req.body;

    //////////////////////////////////////////////////////
    // VALIDATION
    //////////////////////////////////////////////////////

    const requiredFields = [
      "name",
      "email",
      "password",

      "organisationName",
      "ownerName",
      "establishmentDate",

      "gstNumber",
      "panNumber",

      "address",

      "contactNumber",
      "officialEmail",
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({
          success: false,

          message: `${field} is required`,
        });
      }
    }

    //////////////////////////////////////////////////////
    // SERVICE CALL
    //////////////////////////////////////////////////////

    const result = await partnerService.createPartnerSignup(data);

    //////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////

    return res.status(201).json({
      success: true,

      message: "Partner signup successful. Waiting for admin approval.",

      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
// GET PENDING REQUESTS
////////////////////////////////////////////////////////

async function getPendingRequests(req, res) {
  try {
    const requests = await partnerService.getPendingRequests();

    return res.json({
      success: true,

      count: requests.length,

      data: requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
// APPROVE PARTNER
////////////////////////////////////////////////////////

async function approvePartnerRequest(req, res) {
  try {
    const { partnerId } = req.params;

    const partner = await partnerService.approvePartnerRequest(partnerId);

    return res.json({
      success: true,

      message: "Partner approved successfully",

      data: partner,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
// REJECT PARTNER
////////////////////////////////////////////////////////

async function rejectPartnerRequest(req, res) {
  try {
    const { partnerId } = req.params;

    const partner = await partnerService.rejectPartnerRequest(partnerId);

    return res.json({
      success: true,

      message: "Partner rejected successfully",

      data: partner,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////
// GET MY PROFILE
////////////////////////////////////////////////////////

async function getMyProfile(req, res) {
  try {
    const partner = await partnerService.getMyPartnerProfile(req.user.userId);

    return res.json({
      success: true,

      data: partner,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,

      message: error.message,
    });
  }
}

////////////////////////////////////////////////////////

module.exports = {
  signupPartner,
  getPendingRequests,
  approvePartnerRequest,
  rejectPartnerRequest,
  getMyProfile,
};
