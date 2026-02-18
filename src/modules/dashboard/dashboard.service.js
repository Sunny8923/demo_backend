const prisma = require("../../config/prisma");

// ADMIN DASHBOARD
async function getAdminDashboard() {
  const [
    totalJobs,
    activeJobs,
    closedJobs,

    totalPartners,
    pendingPartners,
    approvedPartners,

    totalCandidates,

    totalApplications,

    recentJobs,
    recentPartners,
  ] = await Promise.all([
    prisma.job.count(),

    prisma.job.count({
      where: { status: "open" },
    }),

    prisma.job.count({
      where: { status: "closed" },
    }),

    prisma.partner.count(),

    prisma.partner.count({
      where: { status: "PENDING" },
    }),

    prisma.partner.count({
      where: { status: "APPROVED" },
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
    jobs: {
      total: totalJobs,
      active: activeJobs,
      closed: closedJobs,
    },

    partners: {
      total: totalPartners,
      pending: pendingPartners,
      approved: approvedPartners,
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
        status: "APPLIED",
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        status: "HIRED",
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        status: "REJECTED",
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
        status: "APPLIED",
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: userId,
        status: "HIRED",
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: userId,
        status: "REJECTED",
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
