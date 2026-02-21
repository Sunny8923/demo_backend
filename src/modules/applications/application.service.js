const prisma = require("../../config/prisma");

////////////////////////////////////////////////////////
/// Helper: Determine source safely
////////////////////////////////////////////////////////

function getSource(application) {
  if (application.appliedByPartnerId) return "PARTNER";
  if (application.appliedByUserId) {
    if (application.appliedByUser?.role === "RECRUITER") return "RECRUITER";
    if (application.appliedByUser?.role === "USER") return "USER";
    return "USER";
  }
  return "UNKNOWN";
}

////////////////////////////////////////////////////////
/// APPLY TO JOB (Supports USER, RECRUITER, PARTNER)
////////////////////////////////////////////////////////

async function applyToJob({ jobId, candidateData, userId, role, partnerId }) {
  //////////////////////////////////////////////////////
  // Step 1: Validate job
  //////////////////////////////////////////////////////

  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error("Job not found");
  }

  if (job.status !== "OPEN") {
    throw new Error("Job is not open for applications");
  }

  //////////////////////////////////////////////////////
  // Step 2: Find candidate globally
  //////////////////////////////////////////////////////

  let candidate = await prisma.candidate.findUnique({
    where: {
      email_phone: {
        email: candidateData.email,
        phone: candidateData.phone,
      },
    },
  });

  //////////////////////////////////////////////////////
  // Step 3: Create candidate if not exists
  //////////////////////////////////////////////////////

  if (!candidate) {
    candidate = await prisma.candidate.create({
      data: {
        name: candidateData.name,
        email: candidateData.email,
        phone: candidateData.phone,

        currentLocation: candidateData.currentLocation,
        preferredLocations: candidateData.preferredLocations,
        hometown: candidateData.hometown,
        pincode: candidateData.pincode,

        totalExperience: candidateData.totalExperience,
        currentCompany: candidateData.currentCompany,
        currentDesignation: candidateData.currentDesignation,
        department: candidateData.department,
        industry: candidateData.industry,
        skills: candidateData.skills,
        currentSalary: candidateData.currentSalary,
        expectedSalary: candidateData.expectedSalary,
        noticePeriodDays: candidateData.noticePeriodDays,

        highestQualification: candidateData.highestQualification,
        specialization: candidateData.specialization,
        university: candidateData.university,
        graduationYear: candidateData.graduationYear,

        dateOfBirth: candidateData.dateOfBirth
          ? new Date(candidateData.dateOfBirth)
          : null,

        gender: candidateData.gender,
        maritalStatus: candidateData.maritalStatus,

        // FIXED: recruiter and user both stored here
        createdByUserId:
          role === "USER" || role === "RECRUITER" ? userId : null,

        createdByPartnerId: role === "PARTNER" ? partnerId : null,
      },
    });
  } else {
    //////////////////////////////////////////////////////
    // Step 4: Update missing fields only
    //////////////////////////////////////////////////////

    candidate = await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        currentLocation:
          candidateData.currentLocation ?? candidate.currentLocation,

        preferredLocations:
          candidateData.preferredLocations ?? candidate.preferredLocations,

        hometown: candidateData.hometown ?? candidate.hometown,

        pincode: candidateData.pincode ?? candidate.pincode,

        totalExperience:
          candidateData.totalExperience ?? candidate.totalExperience,

        currentCompany:
          candidateData.currentCompany ?? candidate.currentCompany,

        currentDesignation:
          candidateData.currentDesignation ?? candidate.currentDesignation,

        department: candidateData.department ?? candidate.department,

        industry: candidateData.industry ?? candidate.industry,

        skills: candidateData.skills ?? candidate.skills,

        currentSalary: candidateData.currentSalary ?? candidate.currentSalary,

        expectedSalary:
          candidateData.expectedSalary ?? candidate.expectedSalary,

        noticePeriodDays:
          candidateData.noticePeriodDays ?? candidate.noticePeriodDays,

        highestQualification:
          candidateData.highestQualification ?? candidate.highestQualification,

        specialization:
          candidateData.specialization ?? candidate.specialization,

        university: candidateData.university ?? candidate.university,

        graduationYear:
          candidateData.graduationYear ?? candidate.graduationYear,

        dateOfBirth: candidateData.dateOfBirth
          ? new Date(candidateData.dateOfBirth)
          : candidate.dateOfBirth,

        gender: candidateData.gender ?? candidate.gender,

        maritalStatus: candidateData.maritalStatus ?? candidate.maritalStatus,
      },
    });
  }

  //////////////////////////////////////////////////////
  // Step 5: Prevent duplicate application
  //////////////////////////////////////////////////////

  const existingApplication = await prisma.application.findUnique({
    where: {
      candidateId_jobId: {
        candidateId: candidate.id,
        jobId,
      },
    },
  });

  if (existingApplication) {
    throw new Error("Candidate already applied to this job");
  }

  //////////////////////////////////////////////////////
  // Step 6: Determine source correctly
  //////////////////////////////////////////////////////

  let source = "UNKNOWN";

  if (role === "PARTNER") source = "PARTNER";
  else if (role === "RECRUITER") source = "RECRUITER";
  else if (role === "USER") source = "USER";

  //////////////////////////////////////////////////////
  // Step 7: Create application
  //////////////////////////////////////////////////////

  const application = await prisma.application.create({
    data: {
      jobId,
      candidateId: candidate.id,

      appliedByUserId: role === "USER" || role === "RECRUITER" ? userId : null,

      appliedByPartnerId: role === "PARTNER" ? partnerId : null,

      pipelineStage: "APPLIED",

      source,
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
          role: true,
        },
      },
    },
  });

  //////////////////////////////////////////////////////
  // Step 8: Increment applications count
  //////////////////////////////////////////////////////

  await prisma.job.update({
    where: { id: jobId },
    data: {
      applicationsCount: {
        increment: 1,
      },
    },
  });

  //////////////////////////////////////////////////////
  // Step 9: Return application
  //////////////////////////////////////////////////////

  return application;
}

////////////////////////////////////////////////////////
/// GET MY APPLICATIONS
////////////////////////////////////////////////////////

async function getMyApplications({ userId, role, partnerId }) {
  let where = {};

  if (role === "PARTNER") {
    where = { appliedByPartnerId: partnerId };
  } else {
    where = { appliedByUserId: userId };
  }

  const applications = await prisma.application.findMany({
    where,

    include: {
      job: true,
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
          role: true,
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

////////////////////////////////////////////////////////
/// GET ALL APPLICATIONS (ADMIN)
////////////////////////////////////////////////////////

async function getAllApplications() {
  const applications = await prisma.application.findMany({
    include: {
      job: true,
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
          role: true,
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

////////////////////////////////////////////////////////
/// UPDATE PIPELINE STAGE (ADMIN + RECRUITER)
////////////////////////////////////////////////////////

async function updateApplicationStatus(applicationId, pipelineStage) {
  const validStages = [
    "APPLIED",
    "SCREENING",
    "CONTACTED",
    "DOCUMENT_REQUESTED",
    "DOCUMENT_RECEIVED",
    "SUBMITTED_TO_CLIENT",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "SHORTLISTED",
    "OFFER_SENT",
    "OFFER_ACCEPTED",
    "OFFER_REJECTED",
    "HIRED",
    "REJECTED",
  ];

  if (!validStages.includes(pipelineStage)) {
    throw new Error("Invalid pipeline stage");
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const now = new Date();

  const updateData = {
    pipelineStage,
  };

  if (pipelineStage === "HIRED") {
    updateData.finalStatus = "HIRED";
    updateData.hiredAt = now;
  }

  if (pipelineStage === "REJECTED") {
    updateData.finalStatus = "REJECTED";
    updateData.rejectedAt = now;
  }

  if (pipelineStage === "CONTACTED") {
    updateData.contactedAt = now;
  }

  if (pipelineStage === "INTERVIEW_SCHEDULED") {
    updateData.interviewScheduledAt = now;
  }

  if (pipelineStage === "INTERVIEW_COMPLETED") {
    updateData.interviewCompletedAt = now;
  }

  if (pipelineStage === "OFFER_SENT") {
    updateData.offerSentAt = now;
  }

  if (pipelineStage === "OFFER_ACCEPTED") {
    updateData.offerAcceptedAt = now;
  }

  if (pipelineStage === "OFFER_REJECTED") {
    updateData.offerRejectedAt = now;
  }

  return prisma.application.update({
    where: { id: applicationId },
    data: updateData,

    include: {
      job: true,
      candidate: true,
      appliedByPartner: true,
      appliedByUser: true,
    },
  });
}

////////////////////////////////////////////////////////

module.exports = {
  applyToJob,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus,
};
