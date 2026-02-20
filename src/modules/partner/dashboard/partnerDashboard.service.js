const prisma = require("../../../config/prisma");

//////////////////////////////////////////////////////
// HELPER: Fill missing dates
//////////////////////////////////////////////////////

function fillMissingDates(data, startDate, days) {
  const map = {};

  data.forEach((item) => {
    const date = new Date(item.date).toISOString().split("T")[0];

    map[date] = item.count;
  });

  const result = [];

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

//////////////////////////////////////////////////////
// MAIN FUNCTION
//////////////////////////////////////////////////////

async function getPartnerDashboard(partnerId, range = "7d") {
  //////////////////////////////////////////////////////
  // DATE RANGE (ONLY ONE startDate — CORRECT)
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
    totalCandidates,
    totalApplications,
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
        finalStatus: null,
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        finalStatus: "HIRED",
      },
    }),

    prisma.application.count({
      where: {
        appliedByPartnerId: partnerId,
        finalStatus: "REJECTED",
      },
    }),
  ]);

  const summary = {
    totalCandidates,

    totalApplications,

    activeApplications,

    hired: hiredApplications,

    rejected: rejectedApplications,
  };

  //////////////////////////////////////////////////////
  // PIPELINE
  //////////////////////////////////////////////////////

  const pipelineRaw = await prisma.application.groupBy({
    by: ["pipelineStage"],

    _count: {
      pipelineStage: true,
    },

    where: {
      appliedByPartnerId: partnerId,
    },
  });

  const pipeline = {};

  pipelineRaw.forEach((item) => {
    pipeline[item.pipelineStage] = item._count.pipelineStage;
  });

  //////////////////////////////////////////////////////
  // TRENDS (USE SAME startDate)
  //////////////////////////////////////////////////////

  const applicationsTrend = await prisma.$queryRaw`

    SELECT DATE("createdAt") as date,
           COUNT(*)::int as count
    FROM "Application"
    WHERE "appliedByPartnerId" = ${partnerId}
    AND "createdAt" >= ${startDate}
    GROUP BY DATE("createdAt")
    ORDER BY DATE("createdAt")

  `;

  const hiresTrend = await prisma.$queryRaw`

    SELECT DATE("hiredAt") as date,
           COUNT(*)::int as count
    FROM "Application"
    WHERE "appliedByPartnerId" = ${partnerId}
    AND "hiredAt" IS NOT NULL
    AND "hiredAt" >= ${startDate}
    GROUP BY DATE("hiredAt")
    ORDER BY DATE("hiredAt")

  `;

  const trends = {
    applications: fillMissingDates(applicationsTrend, startDate, days),

    hires: fillMissingDates(hiresTrend, startDate, days),
  };

  //////////////////////////////////////////////////////
  // TOP JOBS
  //////////////////////////////////////////////////////

  const topJobsRaw = await prisma.application.groupBy({
    by: ["jobId"],

    _count: {
      jobId: true,
    },

    where: {
      appliedByPartnerId: partnerId,
    },

    orderBy: {
      _count: {
        jobId: "desc",
      },
    },

    take: 5,
  });

  const jobIds = topJobsRaw.map((j) => j.jobId);

  const jobs = await prisma.job.findMany({
    where: {
      id: { in: jobIds },
    },

    select: {
      id: true,
      title: true,
    },
  });

  const jobMap = {};

  jobs.forEach((j) => {
    jobMap[j.id] = j.title;
  });

  const leaderboards = {
    topJobs: topJobsRaw.map((j) => ({
      jobId: j.jobId,
      jobTitle: jobMap[j.jobId] || "Unknown",
      applications: j._count.jobId,
    })),
  };

  //////////////////////////////////////////////////////
  // CONVERSION
  //////////////////////////////////////////////////////

  const applicationToHireRate =
    totalApplications === 0
      ? 0
      : Number(((hiredApplications / totalApplications) * 100).toFixed(1));

  const conversion = {
    applicationToHireRate,
  };

  //////////////////////////////////////////////////////
  // FINAL RESPONSE
  //////////////////////////////////////////////////////

  return {
    range,

    summary,

    pipeline,

    trends,

    leaderboards,

    conversion,
  };
}

module.exports = {
  getPartnerDashboard,
};
