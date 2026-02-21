const prisma = require("../../../config/prisma");

////////////////////////////////////////////////////////////
/// GET RECRUITER DASHBOARD
////////////////////////////////////////////////////////////

async function getRecruiterDashboard(recruiterId) {
  ////////////////////////////////////////////////////////////
  // SUMMARY COUNTS
  ////////////////////////////////////////////////////////////

  const [
    totalApplications,
    hiredCount,
    rejectedCount,
    activeCount,

    ////////////////////////////////////////////////////////////
    // NEW — TOTAL CANDIDATES ADDED BY RECRUITER
    ////////////////////////////////////////////////////////////

    totalCandidatesAdded,

    ////////////////////////////////////////////////////////////
    // NEW — DISTINCT JOBS WORKED ON BY RECRUITER
    ////////////////////////////////////////////////////////////

    jobsWorkedOnDistinct,
  ] = await Promise.all([
    prisma.application.count({
      where: {
        appliedByUserId: recruiterId,
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: recruiterId,
        finalStatus: "HIRED",
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: recruiterId,
        finalStatus: "REJECTED",
      },
    }),

    prisma.application.count({
      where: {
        appliedByUserId: recruiterId,
        finalStatus: null,
      },
    }),

    ////////////////////////////////////////////////////////////
    // COUNT CANDIDATES CREATED BY RECRUITER
    ////////////////////////////////////////////////////////////

    prisma.candidate.count({
      where: {
        createdByUserId: recruiterId,
      },
    }),

    ////////////////////////////////////////////////////////////
    // DISTINCT JOB COUNT
    ////////////////////////////////////////////////////////////

    prisma.application.findMany({
      where: {
        appliedByUserId: recruiterId,
      },
      select: {
        jobId: true,
      },
      distinct: ["jobId"],
    }),
  ]);

  ////////////////////////////////////////////////////////////
  // CALCULATED FIELDS
  ////////////////////////////////////////////////////////////

  const activeJobsWorkedOn = jobsWorkedOnDistinct.length;

  const hireRate =
    totalApplications === 0
      ? 0
      : Number(((hiredCount / totalApplications) * 100).toFixed(1));

  ////////////////////////////////////////////////////////////
  // PIPELINE BREAKDOWN
  ////////////////////////////////////////////////////////////

  const pipelineRaw = await prisma.application.groupBy({
    by: ["pipelineStage"],

    where: {
      appliedByUserId: recruiterId,
    },

    _count: {
      pipelineStage: true,
    },
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

  ////////////////////////////////////////////////////////////
  // RECENT APPLICATIONS
  ////////////////////////////////////////////////////////////

  const recentApplications = await prisma.application.findMany({
    where: {
      appliedByUserId: recruiterId,
    },

    include: {
      job: {
        select: {
          id: true,
          title: true,
          companyName: true,
          location: true,
        },
      },

      candidate: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    take: 5,
  });

  ////////////////////////////////////////////////////////////
  // FINAL RESPONSE
  ////////////////////////////////////////////////////////////

  return {
    summary: {
      ////////////////////////////////////////////////////////////
      // NEW FIELDS
      ////////////////////////////////////////////////////////////

      totalCandidatesAdded,
      activeJobsWorkedOn,
      hireRate,

      ////////////////////////////////////////////////////////////
      // EXISTING FIELDS
      ////////////////////////////////////////////////////////////

      totalApplications,
      active: activeCount,
      hired: hiredCount,
      rejected: rejectedCount,
    },

    pipeline,

    recentApplications,
  };
}

////////////////////////////////////////////////////////////

module.exports = {
  getRecruiterDashboard,
};
