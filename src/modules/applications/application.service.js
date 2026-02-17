const prisma = require("../../config/prisma");

async function applyToJob({
  jobId,
  candidateName,
  candidateEmail,
  candidatePhone,
  userId,
  role,
}) {
  // 1. check if job exists
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error("Job not found");
  }

  // 2. check duplicate candidate for same user/partner
  const existingCandidate = await prisma.candidate.findFirst({
    where: {
      email: candidateEmail,
      ...(role === "PARTNER"
        ? { createdByPartnerId: userId }
        : { createdByUserId: userId }),
    },
  });

  // reuse existing candidate if found, else create new
  let candidate;

  if (existingCandidate) {
    candidate = existingCandidate;
  } else {
    candidate = await prisma.candidate.create({
      data: {
        name: candidateName,
        email: candidateEmail,
        phone: candidatePhone,
        createdByUserId: role === "USER" ? userId : null,
        createdByPartnerId: role === "PARTNER" ? userId : null,
      },
    });
  }

  // 3. check if already applied to same job
  const existingApplication = await prisma.application.findFirst({
    where: {
      jobId,
      candidateId: candidate.id,
    },
  });

  if (existingApplication) {
    throw new Error("Candidate already applied to this job");
  }

  // 4. create application
  const application = await prisma.application.create({
    data: {
      job: {
        connect: { id: jobId },
      },
      candidate: {
        connect: { id: candidate.id },
      },
      appliedByUserId: role === "USER" ? userId : null,
      appliedByPartnerId: role === "PARTNER" ? userId : null,
    },
    include: {
      candidate: true,
      job: true,
    },
  });

  return application;
}

async function getMyApplications({ userId, role }) {
  const whereCondition =
    role === "PARTNER"
      ? { appliedByPartnerId: userId }
      : { appliedByUserId: userId };

  const applications = await prisma.application.findMany({
    where: whereCondition,
    include: {
      job: {
        select: {
          id: true,
          title: true,
          description: true,
        },
      },
      candidate: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return applications;
}

async function getAllApplications() {
  const applications = await prisma.application.findMany({
    include: {
      job: {
        select: {
          id: true,
          title: true,
        },
      },
      candidate: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return applications;
}

module.exports = {
  applyToJob,
  getMyApplications,
  getAllApplications,
};
