const prisma = require("../../config/prisma");

async function createPartnerRequest({ userId, businessName, phone }) {
  // check if already requested
  const existing = await prisma.partner.findUnique({
    where: {
      userId,
    },
  });

  if (existing) {
    throw new Error("Partner request already exists");
  }

  const partner = await prisma.partner.create({
    data: {
      businessName,
      phone,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });

  return partner;
}

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

async function approvePartnerRequest(partnerId) {
  // first get partner with userId
  const partner = await prisma.partner.findUnique({
    where: {
      id: partnerId,
    },
  });

  if (!partner) {
    throw new Error("Partner request not found");
  }

  // use transaction to update both safely
  const result = await prisma.$transaction(async (tx) => {
    // update partner status
    const updatedPartner = await tx.partner.update({
      where: {
        id: partnerId,
      },
      data: {
        status: "APPROVED",
      },
    });

    // update user role
    await tx.user.update({
      where: {
        id: partner.userId,
      },
      data: {
        role: "PARTNER",
      },
    });

    return updatedPartner;
  });

  return result;
}

module.exports = {
  createPartnerRequest,
  getPendingRequests,
  approvePartnerRequest,
};
