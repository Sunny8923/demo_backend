const prisma = require("../config/prisma");

async function requirePartnerApproved(req, res, next) {
  try {
    // only check for partner role
    if (req.user.role !== "PARTNER") {
      return next();
    }

    const partner = await prisma.partner.findUnique({
      where: {
        userId: req.user.userId,
      },
      select: {
        id: true,
        status: true,
        organisationName: true,
      },
    });

    if (!partner) {
      return res.status(403).json({
        message: "Partner profile not found",
      });
    }

    // Handle PENDING
    if (partner.status === "PENDING") {
      return res.status(403).json({
        message: "Your partner account is pending admin approval",
        status: "PENDING",
      });
    }

    // Handle REJECTED
    if (partner.status === "REJECTED") {
      return res.status(403).json({
        message: "Your partner account has been rejected. Please contact admin",
        status: "REJECTED",
      });
    }

    // Only APPROVED reaches here
    req.partner = partner;

    next();
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = requirePartnerApproved;
