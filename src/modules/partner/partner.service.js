const prisma = require("../../config/prisma");
const bcrypt = require("bcrypt");

////////////////////////////////////////////////////////
// SAFE HELPERS
////////////////////////////////////////////////////////

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

function safeDate(date) {
  const d = new Date(date);

  if (isNaN(d.getTime())) throw new Error("Invalid establishmentDate");

  return d;
}

////////////////////////////////////////////////////////
// CREATE PARTNER SIGNUP
////////////////////////////////////////////////////////

async function createPartnerSignup(data) {
  const email = normalizeEmail(data.email);

  //////////////////////////////////////////////////////
  // CHECK USER EXISTS
  //////////////////////////////////////////////////////

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) throw new Error("Email already registered");

  //////////////////////////////////////////////////////
  // HASH PASSWORD
  //////////////////////////////////////////////////////

  const hashedPassword = await bcrypt.hash(data.password, 10);

  //////////////////////////////////////////////////////
  // TRANSACTION
  //////////////////////////////////////////////////////

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name.trim(),

        email,

        password: hashedPassword,

        role: "PARTNER",
      },
    });

    const partner = await tx.partner.create({
      data: {
        organisationName: data.organisationName,

        ownerName: data.ownerName,

        establishmentDate: safeDate(data.establishmentDate),

        gstNumber: data.gstNumber,

        panNumber: data.panNumber,

        msmeRegistered: Boolean(data.msmeRegistered),

        address: data.address,

        contactNumber: data.contactNumber,

        officialEmail: data.officialEmail,

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

      partner,
    };
  });
}

////////////////////////////////////////////////////////
// GET PENDING REQUESTS
////////////////////////////////////////////////////////

async function getPendingRequests() {
  return prisma.partner.findMany({
    where: { status: "PENDING" },

    include: { user: true },

    orderBy: { createdAt: "desc" },
  });
}

////////////////////////////////////////////////////////
// APPROVE PARTNER
////////////////////////////////////////////////////////

async function approvePartnerRequest(partnerId) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  if (!partner) throw new Error("Partner not found");

  if (partner.status === "APPROVED")
    throw new Error("Partner already approved");

  if (partner.status === "REJECTED")
    throw new Error("Rejected partner cannot be approved");

  return prisma.partner.update({
    where: { id: partnerId },

    data: { status: "APPROVED" },
  });
}

////////////////////////////////////////////////////////
// REJECT PARTNER
////////////////////////////////////////////////////////

async function rejectPartnerRequest(partnerId) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
  });

  if (!partner) throw new Error("Partner not found");

  if (partner.status === "REJECTED")
    throw new Error("Partner already rejected");

  if (partner.status === "APPROVED")
    throw new Error("Approved partner cannot be rejected");

  return prisma.partner.update({
    where: { id: partnerId },

    data: { status: "REJECTED" },
  });
}

////////////////////////////////////////////////////////
// GET MY PROFILE
////////////////////////////////////////////////////////

async function getMyPartnerProfile(userId) {
  const partner = await prisma.partner.findUnique({
    where: { userId },

    include: { user: true },
  });

  if (!partner) throw new Error("Partner profile not found");

  return partner;
}

////////////////////////////////////////////////////////

module.exports = {
  createPartnerSignup,
  getPendingRequests,
  approvePartnerRequest,
  rejectPartnerRequest,
  getMyPartnerProfile,
};
