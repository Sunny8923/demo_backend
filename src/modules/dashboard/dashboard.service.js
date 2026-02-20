const prisma = require("../../config/prisma");

////////////////////////////////////////////////////////////
/// ADMIN DASHBOARD (TOTAL SYSTEM DATA)
////////////////////////////////////////////////////////////

async function getAdminDashboard() {
  const [
    totalUsers,

    totalJobs,
    openJobs,
    closedJobs,
    onHoldJobs,
    cancelledJobs,

    totalPartners,
    pendingPartners,
    approvedPartners,
    rejectedPartners,

    totalCandidates,

    totalApplications,

    recentJobs,
    recentPartners,
  ] = await Promise.all([
    prisma.user.count(),

    prisma.job.count(),

    prisma.job.count({ where: { status: "OPEN" } }),

    prisma.job.count({ where: { status: "CLOSED" } }),

    prisma.job.count({ where: { status: "ON_HOLD" } }),

    prisma.job.count({ where: { status: "CANCELLED" } }),

    prisma.partner.count(),

    prisma.partner.count({ where: { status: "PENDING" } }),

    prisma.partner.count({ where: { status: "APPROVED" } }),

    prisma.partner.count({ where: { status: "REJECTED" } }),

    prisma.candidate.count(),

    prisma.application.count(),

    prisma.job.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        companyName: true,
        status: true,
        createdAt: true,
      },
    }),

    prisma.partner.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        organisationName: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    users: { total: totalUsers },

    jobs: {
      total: totalJobs,
      open: openJobs,
      closed: closedJobs,
      onHold: onHoldJobs,
      cancelled: cancelledJobs,
    },

    partners: {
      total: totalPartners,
      pending: pendingPartners,
      approved: approvedPartners,
      rejected: rejectedPartners,
    },

    candidates: { total: totalCandidates },

    applications: { total: totalApplications },

    recentJobs,
    recentPartners,
  };
}

////////////////////////////////////////////////////////////
/// PARTNER DASHBOARD (ONLY PARTNER DATA)
////////////////////////////////////////////////////////////

async function getPartnerDashboard(partnerId) {
  const [
    candidatesSubmitted,

    applicationsSubmitted,

    activeApplications,

    hiredApplications,

    rejectedApplications,
  ] = await Promise.all([
    /// Candidates created by this partner
    prisma.candidate.count({
      where: {
        createdByPartnerId: partnerId,
      },
    }),

    /// Applications submitted by this partner
    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
      },
    }),

    /// Active applications (not final yet)
    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        finalStatus: null,
      },
    }),

    /// Hired applications
    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        finalStatus: "HIRED",
      },
    }),

    /// Rejected applications
    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        finalStatus: "REJECTED",
      },
    }),
  ]);

  return {
    candidatesSubmitted,

    applicationsSubmitted,

    activeApplications,

    hiredApplications,

    rejectedApplications,
  };
}

////////////////////////////////////////////////////////////
/// USER DASHBOARD (ONLY USER DATA)
////////////////////////////////////////////////////////////

async function getUserDashboard(userId) {
  const [totalApplications, activeApplications, rejectedApplications] =
    await Promise.all([
      /// Applications applied by this user
      prisma.application.count({
        where: {
          appliedByUserId: userId,
        },
      }),

      /// Active applications
      prisma.application.count({
        where: {
          appliedByUserId: userId,
          finalStatus: null,
        },
      }),

      /// Rejected applications
      prisma.application.count({
        where: {
          appliedByUserId: userId,
          finalStatus: "REJECTED",
        },
      }),
    ]);

  return {
    totalApplications,

    activeApplications,

    rejectedApplications,
  };
}

module.exports = {
  getAdminDashboard,
  getPartnerDashboard,
  getUserDashboard,
};
