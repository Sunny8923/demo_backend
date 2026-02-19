const prisma = require("../../config/prisma");

// ADMIN DASHBOARD
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

    prisma.job.count({
      where: { status: "OPEN" },
    }),

    prisma.job.count({
      where: { status: "CLOSED" },
    }),

    prisma.job.count({
      where: { status: "ON_HOLD" },
    }),

    prisma.job.count({
      where: { status: "CANCELLED" },
    }),

    prisma.partner.count(),

    prisma.partner.count({
      where: { status: "PENDING" },
    }),

    prisma.partner.count({
      where: { status: "APPROVED" },
    }),

    prisma.partner.count({
      where: { status: "REJECTED" },
    }),

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
    users: {
      total: totalUsers,
    },

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

    candidates: {
      total: totalCandidates,
    },

    applications: {
      total: totalApplications,
    },

    recentJobs,
    recentPartners,
  };
}

// PARTNER DASHBOARD
async function getPartnerDashboard(partnerId) {
  const [
    candidatesSubmitted,
    applicationsSubmitted,
    activeApplications,
    hiredApplications,
    rejectedApplications,
  ] = await Promise.all([
    prisma.candidate.count({
      where: {
        createdByPartnerId: partnerId,
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        pipelineStage: "APPLIED", // ✅ FIXED
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        finalStatus: "HIRED", // ✅ FIXED
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        finalStatus: "REJECTED", // ✅ FIXED
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

// USER DASHBOARD
async function getUserDashboard(userId) {
  const [
    totalApplications,
    activeApplications,
    hiredApplications,
    rejectedApplications,
  ] = await Promise.all([
    prisma.application.count({
      where: {
        appliedByUserId: userId,
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: userId,
        pipelineStage: "APPLIED", // ✅ FIXED
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: userId,
        finalStatus: "HIRED", // ✅ FIXED
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: userId,
        finalStatus: "REJECTED", // ✅ FIXED
      },
    }),
  ]);

  return {
    totalApplications,
    activeApplications,
    hiredApplications,
    rejectedApplications,
  };
}

module.exports = {
  getAdminDashboard,
  getPartnerDashboard,
  getUserDashboard,
};
