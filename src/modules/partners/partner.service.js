const prisma = require("../../config/prisma");
const bcrypt = require("bcrypt");

// Partner Signup (UPDATED)
async function createPartnerSignup({
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
}) {
  // check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // create user + partner in transaction
  const result = await prisma.$transaction(async (tx) => {
    // create user
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "PARTNER",
      },
    });

    // create partner profile
    const partner = await tx.partner.create({
      data: {
        organisationName,
        ownerName,

        establishmentDate: new Date(establishmentDate),

        gstNumber,
        panNumber,

        msmeRegistered: msmeRegistered === true,

        address,

        contactNumber,

        officialEmail,

        userId: user.id,

        status: "PENDING",
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },

      partner: {
        id: partner.id,
        organisationName: partner.organisationName,
        ownerName: partner.ownerName,
        officialEmail: partner.officialEmail,
        contactNumber: partner.contactNumber,
        status: partner.status,
        createdAt: partner.createdAt,
      },
    };
  });

  return result;
}

// Admin: get pending partners
async function getPendingRequests() {
  const requests = await prisma.partner.findMany({
    where: {
      status: "PENDING",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return requests;
}

// Admin: approve partner
async function approvePartnerRequest(partnerId) {
  const partner = await prisma.partner.findUnique({
    where: {
      id: partnerId,
    },
  });

  if (!partner) {
    throw new Error("Partner not found");
  }

  const updatedPartner = await prisma.partner.update({
    where: {
      id: partnerId,
    },
    data: {
      status: "APPROVED",
    },
  });

  return updatedPartner;
}

async function getMyPartnerProfile(userId) {
  const partner = await prisma.partner.findUnique({
    where: {
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      },
    },
  });

  if (!partner) {
    throw new Error("Partner profile not found");
  }

  return partner;
}

// Admin: reject partner
async function rejectPartnerRequest(partnerId) {
  const partner = await prisma.partner.findUnique({
    where: {
      id: partnerId,
    },
  });

  if (!partner) {
    throw new Error("Partner not found");
  }

  if (partner.status === "REJECTED") {
    throw new Error("Partner already rejected");
  }

  if (partner.status === "APPROVED") {
    throw new Error("Approved partner cannot be rejected");
  }

  const updatedPartner = await prisma.partner.update({
    where: {
      id: partnerId,
    },
    data: {
      status: "REJECTED",
    },
    select: {
      id: true,
      organisationName: true,
      officialEmail: true,
      contactNumber: true,
      status: true,
      createdAt: true,
    },
  });

  return updatedPartner;
}

module.exports = {
  createPartnerSignup,
  getPendingRequests,
  approvePartnerRequest,
  getMyPartnerProfile,
  rejectPartnerRequest,
};
