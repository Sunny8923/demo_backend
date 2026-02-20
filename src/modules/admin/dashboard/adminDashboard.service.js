const prisma = require("../../../config/prisma");

//////////////////////////////////////////////////////
// HELPER: Fill missing dates with 0
//////////////////////////////////////////////////////

function fillMissingDates(data, startDate, days) {
  const map = {};

  // Convert DB result into map
  data.forEach((item) => {
    const date = new Date(item.date).toISOString().split("T")[0];

    map[date] = item.count;
  });

  const result = [];

  // Generate all dates in range
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);

    d.setDate(startDate.getDate() + i);

    const date = d.toISOString().split("T")[0];

    result.push({
      date,
      count: map[date] || 0,
    });
  }

  return result;
}

async function getAdminDashboard(range = "7d") {
  //////////////////////////////////////////////////////
  // DATE RANGE (FIXED - SINGLE SOURCE OF TRUTH)
  //////////////////////////////////////////////////////

  let days = 7;

  if (range === "30d") days = 30;
  else if (range === "90d") days = 90;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  //////////////////////////////////////////////////////
  // SUMMARY
  //////////////////////////////////////////////////////

  const [
    totalPartners,
    activePartners,
    pendingPartners,

    totalJobs,
    openJobs,
    closedJobs,

    totalApplications,

    activeApplications,
    hiredApplications,
    rejectedApplications,
  ] = await Promise.all([
    prisma.partner.count(),

    prisma.partner.count({
      where: { status: "APPROVED" },
    }),

    prisma.partner.count({
      where: { status: "PENDING" },
    }),

    prisma.job.count(),

    prisma.job.count({
      where: { status: "OPEN" },
    }),

    prisma.job.count({
      where: { status: "CLOSED" },
    }),

    prisma.application.count(),

    prisma.application.count({
      where: { finalStatus: null },
    }),

    prisma.application.count({
      where: { finalStatus: "HIRED" },
    }),

    prisma.application.count({
      where: { finalStatus: "REJECTED" },
    }),
  ]);

  //////////////////////////////////////////////////////
  // PIPELINE
  //////////////////////////////////////////////////////

  const pipelineRaw = await prisma.application.groupBy({
    by: ["pipelineStage"],
    _count: { pipelineStage: true },
  });

  const pipeline = {
    APPLIED: 0,
    SCREENING: 0,
    CONTACTED: 0,
    DOCUMENT_REQUESTED: 0,
    DOCUMENT_RECEIVED: 0,
    SUBMITTED_TO_CLIENT: 0,
    INTERVIEW_SCHEDULED: 0,
    INTERVIEW_COMPLETED: 0,
    SHORTLISTED: 0,
    OFFER_SENT: 0,
    OFFER_ACCEPTED: 0,
    OFFER_REJECTED: 0,
    HIRED: 0,
    REJECTED: 0,
  };

  pipelineRaw.forEach((item) => {
    pipeline[item.pipelineStage] = item._count.pipelineStage;
  });

  //////////////////////////////////////////////////////
  // TRENDS (NOW USES RANGE startDate)
  //////////////////////////////////////////////////////

  const applicationsTrendRaw = await prisma.$queryRaw`

    SELECT DATE("createdAt") as date,
           COUNT(*)::int as count
    FROM "Application"
    WHERE "createdAt" >= ${startDate}
    GROUP BY DATE("createdAt")
    ORDER BY DATE("createdAt")

  `;

  const hiresTrendRaw = await prisma.$queryRaw`

    SELECT DATE("hiredAt") as date,
           COUNT(*)::int as count
    FROM "Application"
    WHERE "hiredAt" IS NOT NULL
    AND "hiredAt" >= ${startDate}
    GROUP BY DATE("hiredAt")
    ORDER BY DATE("hiredAt")

  `;

  const jobsTrendRaw = await prisma.$queryRaw`

    SELECT DATE("createdAt") as date,
           COUNT(*)::int as count
    FROM "Job"
    WHERE "createdAt" >= ${startDate}
    GROUP BY DATE("createdAt")
    ORDER BY DATE("createdAt")

  `;

  const trends = {
    applications: fillMissingDates(applicationsTrendRaw, startDate, days),

    hires: fillMissingDates(hiresTrendRaw, startDate, days),

    jobsCreated: fillMissingDates(jobsTrendRaw, startDate, days),
  };

  //////////////////////////////////////////////////////
  // DISTRIBUTION
  //////////////////////////////////////////////////////

  const [partnerApplications, userApplications] = await Promise.all([
    prisma.application.count({
      where: {
        appliedByPartnerId: { not: null },
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: { not: null },
      },
    }),
  ]);

  const applicationsBySource = {
    partner: partnerApplications,
    user: userApplications,
  };

  const applicationsByDepartment = await prisma.$queryRaw`

    SELECT j."department",
           COUNT(a.id)::int as applications
    FROM "Application" a
    JOIN "Job" j ON a."jobId" = j.id
    WHERE j."department" IS NOT NULL
    GROUP BY j."department"
    ORDER BY applications DESC

  `;

  const topJobsRaw = await prisma.job.findMany({
    take: 5,
    orderBy: {
      applicationsCount: "desc",
    },
    select: {
      id: true,
      title: true,
      applicationsCount: true,
    },
  });

  const applicationsByJob = topJobsRaw.map((job) => ({
    jobId: job.id,
    jobTitle: job.title,
    applications: job.applicationsCount,
  }));

  const distribution = {
    applicationsBySource,
    applicationsByDepartment,
    applicationsByJob,
  };

  //////////////////////////////////////////////////////
  // LEADERBOARDS
  //////////////////////////////////////////////////////

  const topPartnersRaw = await prisma.application.groupBy({
    by: ["appliedByPartnerId"],
    _count: { appliedByPartnerId: true },
    orderBy: {
      _count: {
        appliedByPartnerId: "desc",
      },
    },
    take: 5,
    where: {
      appliedByPartnerId: { not: null },
    },
  });

  const partnerIds = topPartnersRaw.map((p) => p.appliedByPartnerId);

  const partners = await prisma.partner.findMany({
    where: {
      id: { in: partnerIds },
    },
    select: {
      id: true,
      organisationName: true,
    },
  });

  const partnerMap = {};
  partners.forEach((p) => {
    partnerMap[p.id] = p.organisationName;
  });

  const topPartners = topPartnersRaw.map((p) => ({
    partnerId: p.appliedByPartnerId,
    partnerName: partnerMap[p.appliedByPartnerId] || "Unknown",
    applications: p._count.appliedByPartnerId,
  }));

  const topRecruitersRaw = await prisma.application.groupBy({
    by: ["appliedByUserId"],
    _count: { appliedByUserId: true },
    orderBy: {
      _count: {
        appliedByUserId: "desc",
      },
    },
    take: 5,
    where: {
      appliedByUserId: { not: null },
    },
  });

  const userIds = topRecruitersRaw.map((u) => u.appliedByUserId);

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const userMap = {};
  users.forEach((u) => {
    userMap[u.id] = u.name;
  });

  const topRecruiters = topRecruitersRaw.map((u) => ({
    userId: u.appliedByUserId,
    userName: userMap[u.appliedByUserId] || "Unknown",
    applications: u._count.appliedByUserId,
  }));

  const leaderboards = {
    topPartners,
    topRecruiters,
    topJobs: applicationsByJob,
  };

  //////////////////////////////////////////////////////
  // CONVERSION
  //////////////////////////////////////////////////////

  const [totalApps, screeningCount, interviewScheduledCount, hiredCount] =
    await Promise.all([
      prisma.application.count(),

      prisma.application.count({
        where: {
          pipelineStage: "SCREENING",
        },
      }),

      prisma.application.count({
        where: {
          pipelineStage: "INTERVIEW_SCHEDULED",
        },
      }),

      prisma.application.count({
        where: {
          pipelineStage: "HIRED",
        },
      }),
    ]);

  function calculateRate(n, d) {
    if (!d) return 0;
    return Number(((n / d) * 100).toFixed(1));
  }

  const conversion = {
    applicationToHireRate: calculateRate(hiredCount, totalApps),

    screeningToInterviewRate: calculateRate(
      interviewScheduledCount,
      screeningCount,
    ),

    interviewToHireRate: calculateRate(hiredCount, interviewScheduledCount),
  };

  //////////////////////////////////////////////////////
  // FINAL RESPONSE
  //////////////////////////////////////////////////////

  return {
    range,

    summary: {
      totalPartners,
      activePartners,
      pendingPartners,
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      activeApplications,
      hired: hiredApplications,
      rejected: rejectedApplications,
    },

    pipeline,

    trends,

    distribution,

    leaderboards,

    conversion,
  };
}

module.exports = {
  getAdminDashboard,
};
