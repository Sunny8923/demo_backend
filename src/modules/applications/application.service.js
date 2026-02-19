const prisma = require("../../config/prisma");

////////////////////////////////////////////////////////
/// Helper: Determine source
////////////////////////////////////////////////////////

function getSource(application) {
  if (application.appliedByPartnerId) return "PARTNER";
  if (application.appliedByUserId) return "DIRECT";
  return "UNKNOWN";
}

////////////////////////////////////////////////////////
/// APPLY TO JOB (FULL ENTERPRISE VERSION)
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
  // Step 2: Find candidate globally (email + phone)
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
  // Step 3: Create OR update candidate
  //////////////////////////////////////////////////////

  if (!candidate) {
    //////////////////////////////////////////////////
    // CREATE NEW CANDIDATE
    //////////////////////////////////////////////////

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

        createdByUserId: role === "USER" ? userId : null,
        createdByPartnerId: role === "PARTNER" ? partnerId : null,
      },
    });
  } else {
    //////////////////////////////////////////////////
    // UPDATE EXISTING CANDIDATE (only fill missing fields)
    //////////////////////////////////////////////////

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
  // Step 4: Prevent duplicate application
  //////////////////////////////////////////////////////

  const existingApplication = await prisma.application.findUnique({
    where: {
      candidateId_jobId: {
        candidateId: candidate.id,
        jobId: jobId,
      },
    },
  });

  if (existingApplication) {
    throw new Error("Candidate already applied to this job");
  }

  //////////////////////////////////////////////////////
  // Step 5: Determine source
  //////////////////////////////////////////////////////

  const source =
    role === "PARTNER" ? "PARTNER" : role === "USER" ? "DIRECT" : "UNKNOWN";

  //////////////////////////////////////////////////////
  // Step 6: Create application
  //////////////////////////////////////////////////////

  const application = await prisma.application.create({
    data: {
      jobId,
      candidateId: candidate.id,

      appliedByUserId: role === "USER" ? userId : null,

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
        },
      },
    },
  });

  //////////////////////////////////////////////////////
  // Step 7: Increment job applicationsCount
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
  // Step 8: Return result
  //////////////////////////////////////////////////////

  return application;
}

////////////////////////////////////////////////////////
/// GET MY APPLICATIONS
////////////////////////////////////////////////////////

async function getMyApplications({ userId, role, partnerId }) {
  console.log("DEBUG GET MY APPLICATIONS");
  console.log("userId:", userId);
  console.log("role:", role);
  console.log("partnerId:", partnerId);

  const where =
    role === "PARTNER"
      ? { appliedByPartnerId: partnerId }
      : { appliedByUserId: userId };

  console.log("WHERE:", where);

  const applications = await prisma.application.findMany({
    where,
    include: {
      job: true,
      candidate: true,
      appliedByPartner: true,
      appliedByUser: true,
    },
  });

  console.log("FOUND APPLICATIONS:", applications.length);

  return applications;
}

////////////////////////////////////////////////////////
/// GET ALL APPLICATIONS (ADMIN)
////////////////////////////////////////////////////////

async function getAllApplications() {
  const applications = await prisma.application.findMany({
    include: {
      job: {
        select: {
          id: true,
          title: true,
          companyName: true,
          location: true,
          status: true,
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

////////////////////////////////////////////////////////
/// UPDATE PIPELINE STAGE
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

  const updatedApplication = await prisma.application.update({
    where: { id: applicationId },

    data: updateData,

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

  return updatedApplication;
}

////////////////////////////////////////////////////////
/// EXPORTS
////////////////////////////////////////////////////////

module.exports = {
  applyToJob,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus,
};
