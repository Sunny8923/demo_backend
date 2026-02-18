const prisma = require("../../config/prisma");

function getSource(application) {
  if (application.appliedByPartnerId) return "PARTNER";
  if (application.appliedByUserId) return "DIRECT";
  return "UNKNOWN";
}

async function applyToJob({
  jobId,
  candidateName,
  candidateEmail,
  candidatePhone,
  userId,
  role,
  partnerId,
}) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error("Job not found");
  }

  // find or create candidate
  let candidate = await prisma.candidate.findFirst({
    where: {
      email: candidateEmail,
      ...(role === "PARTNER"
        ? { createdByPartnerId: partnerId }
        : { createdByUserId: userId }),
    },
  });

  if (!candidate) {
    candidate = await prisma.candidate.create({
      data: {
        name: candidateName,
        email: candidateEmail,
        phone: candidatePhone,
        createdByUserId: role === "USER" ? userId : null,
        createdByPartnerId: role === "PARTNER" ? partnerId : null,
      },
    });
  }

  // prevent duplicate application
  const existingApplication = await prisma.application.findFirst({
    where: {
      jobId,
      candidateId: candidate.id,
    },
  });

  if (existingApplication) {
    throw new Error("Candidate already applied to this job");
  }

  const application = await prisma.application.create({
    data: {
      jobId,
      candidateId: candidate.id,
      appliedByUserId: role === "USER" ? userId : null,
      appliedByPartnerId: role === "PARTNER" ? partnerId : null,
    },

    include: {
      job: {
        select: {
          id: true,
          title: true,
          companyName: true,
        },
      },

      candidate: true,

      appliedByPartner: {
        select: {
          id: true,
          organisationName: true,
        },
      },

      appliedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    ...application,
    source: getSource(application),
  };
}

async function getMyApplications({ userId, role, partnerId }) {
  const where =
    role === "PARTNER"
      ? { appliedByPartnerId: partnerId }
      : { appliedByUserId: userId };

  const applications = await prisma.application.findMany({
    where,

    include: {
      job: {
        select: {
          id: true,
          title: true,
          companyName: true,
          location: true,
        },
      },

      candidate: true,

      appliedByPartner: {
        select: {
          id: true,
          organisationName: true,
        },
      },

      appliedByUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return applications.map((app) => ({
    ...app,
    source: getSource(app),
  }));
}

async function getAllApplications() {
  const applications = await prisma.application.findMany({
    include: {
      job: {
        select: {
          id: true,
          title: true,
          companyName: true,
        },
      },

      candidate: true,

      appliedByPartner: {
        select: {
          id: true,
          organisationName: true,
        },
      },

      appliedByUser: {
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

  return applications.map((app) => ({
    ...app,
    source: getSource(app),
  }));
}

async function updateApplicationStatus(applicationId, status) {
  const validStatuses = ["APPLIED", "HIRED", "REJECTED"];

  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  const application = await prisma.application.findUnique({
    where: {
      id: applicationId,
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const updatedApplication = await prisma.application.update({
    where: {
      id: applicationId,
    },
    data: {
      status,
    },

    include: {
      job: {
        select: {
          id: true,
          title: true,
          companyName: true,
        },
      },

      candidate: true,

      appliedByPartner: {
        select: {
          id: true,
          organisationName: true,
        },
      },

      appliedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const source = updatedApplication.appliedByPartnerId ? "PARTNER" : "DIRECT";

  return {
    ...updatedApplication,
    source,
  };
}

module.exports = {
  applyToJob,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus,
};
