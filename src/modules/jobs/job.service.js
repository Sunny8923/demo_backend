const prisma = require("../../config/prisma");

const fs = require("fs");
const csv = require("csv-parser");

async function createJob({
  jrCode,
  title,
  description,
  companyName,
  department,
  location,
  minExperience,
  maxExperience,
  salaryMin,
  salaryMax,
  openings,
  skills,
  education,
  status,
  requestDate,
  closureDate,
  createdById,
}) {
  const job = await prisma.job.create({
    data: {
      jrCode: jrCode || null,

      title,
      description: description || null,

      companyName: companyName || null,
      department: department || null,
      location: location || null,

      minExperience: minExperience ?? null,
      maxExperience: maxExperience ?? null,

      salaryMin: salaryMin ?? null,
      salaryMax: salaryMax ?? null,

      openings: openings ?? 1,

      skills: skills || null,
      education: education || null,

      status: normalizeStatus(status) || "OPEN",

      requestDate: requestDate ? new Date(requestDate) : null,
      closureDate: closureDate ? new Date(closureDate) : null,

      createdBy: {
        connect: {
          id: createdById,
        },
      },
    },

    select: {
      id: true,
      jrCode: true,
      title: true,
      companyName: true,
      location: true,
      openings: true,
      status: true,
      createdAt: true,
    },
  });

  return job;
}

async function getAllJobs() {
  const jobs = await prisma.job.findMany({
    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      jrCode: true,

      title: true,
      description: true,

      companyName: true,
      department: true,
      location: true,

      minExperience: true,
      maxExperience: true,

      salaryMin: true,
      salaryMax: true,

      openings: true,
      skills: true,
      education: true,

      status: true,
      requestDate: true,
      closureDate: true,

      createdAt: true,

      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },

      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  return jobs;
}

async function createJobsFromCSV(filePath, createdById) {
  return new Promise((resolve, reject) => {
    const jobs = [];
    const errors = [];

    let totalRows = 0;
    let skipped = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        totalRows++;

        try {
          // Normalize keys
          const normalizedRow = {};
          Object.keys(row).forEach((key) => {
            normalizedRow[key.trim()] = row[key];
          });

          const get = (key) => {
            const value = normalizedRow[key];
            return value ? value.toString().trim() : null;
          };

          // Build location safely
          const state = get("STATE");
          const district = get("DISTRICT");

          const location =
            get("Location") ||
            (state && district
              ? `${district}, ${state}`
              : state || district || null);

          // Universal mapping (supports JR_Master format)
          const job = {
            jrCode: get("JR Code") || get("Job Code"),

            title: get("Designation") || get("Job Title/Requirement Name"),

            description: get("Job Description") || null,

            companyName: get("Client Name") || get("Company"),

            department: get("Department") || get("Vertical") || get("Division"),

            location,

            minExperience: parseInt(get("Min Experience")) || null,

            maxExperience: parseInt(get("Max Experience")) || null,

            salaryMin:
              parseSalary(get("Salary Min")) || parseSalary(get("CtC -min")),

            salaryMax:
              parseSalary(get("Salary Max")) || parseSalary(get("CTC-Max")),

            openings:
              parseInt(get("No. of Positions")) ||
              parseInt(get("No Of Openings")) ||
              1,

            skills: get("Skills Required") || null,

            education: get("Education Required") || null,

            status: normalizeStatus(get("Status")) || "OPEN",

            requestDate:
              get("Request Date") || get("Start Date")
                ? new Date(get("Request Date") || get("Start Date"))
                : null,

            closureDate:
              get("Target Closure Date") || get("Closed Date")
                ? new Date(get("Target Closure Date") || get("Closed Date"))
                : null,

            createdById,
          };

          // Validate required fields
          if (!job.title || !job.companyName || !job.location) {
            skipped++;

            errors.push({
              row: totalRows,
              jrCode: job.jrCode,
              title: job.title,
              error: "Missing required fields (title, companyName, location)",
            });

            return;
          }

          jobs.push(job);
        } catch (err) {
          skipped++;

          errors.push({
            row: totalRows,
            error: err.message,
          });
        }
      })

      .on("end", async () => {
        try {
          if (jobs.length === 0) {
            return resolve({
              success: false,
              summary: {
                totalRows,
                created: 0,
                skipped,
                failed: errors.length,
              },
              errors,
            });
          }

          const result = await prisma.job.createMany({
            data: jobs,
            skipDuplicates: true,
          });

          const createdCount = result.count;
          const duplicateCount = jobs.length - createdCount;

          resolve({
            success: true,

            summary: {
              totalRows,
              validRows: jobs.length,
              created: createdCount,
              duplicates: duplicateCount,
              skipped,
              failed: errors.length,
            },

            errors,
          });
        } catch (error) {
          reject(error);
        }
      })

      .on("error", reject);
  });
}

function normalizeStatus(status) {
  if (!status) return "OPEN";

  const normalized = status.toString().trim().toUpperCase();

  const allowed = ["OPEN", "CLOSED", "ON_HOLD", "CANCELLED"];

  return allowed.includes(normalized) ? normalized : "OPEN";
}

async function getJobById(jobId) {
  const job = await prisma.job.findUnique({
    where: {
      id: jobId,
    },

    select: {
      id: true,
      jrCode: true,

      title: true,
      description: true,

      companyName: true,
      department: true,
      location: true,

      minExperience: true,
      maxExperience: true,

      salaryMin: true,
      salaryMax: true,

      openings: true,

      skills: true,
      education: true,

      status: true,

      requestDate: true,
      closureDate: true,

      createdAt: true,

      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },

      applications: {
        select: {
          id: true,
          status: true,
          createdAt: true,

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
      },

      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error("Job not found");
  }

  return job;
}

function parseSalary(value) {
  if (!value) return null;

  // remove commas and spaces
  const cleaned = value.toString().replace(/,/g, "").trim();

  const number = parseInt(cleaned);

  return isNaN(number) ? null : number;
}

// UPDATE JOB
async function updateJob(jobId, data) {
  const existingJob = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!existingJob) {
    throw new Error("Job not found");
  }

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: {
      jrCode: data.jrCode,
      title: data.title,
      description: data.description,

      companyName: data.companyName,
      department: data.department,
      location: data.location,

      minExperience: data.minExperience,
      maxExperience: data.maxExperience,

      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,

      openings: data.openings,

      skills: data.skills,
      education: data.education,

      status: data.status,

      requestDate: data.requestDate ? new Date(data.requestDate) : undefined,

      closureDate: data.closureDate ? new Date(data.closureDate) : undefined,
    },
  });

  return updatedJob;
}

// DELETE JOB
async function deleteJob(jobId) {
  const existingJob = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!existingJob) {
    throw new Error("Job not found");
  }

  await prisma.job.delete({
    where: { id: jobId },
  });

  return { message: "Job deleted successfully" };
}

module.exports = {
  createJob,
  getAllJobs,
  createJobsFromCSV,
  getJobById,
  updateJob,
  deleteJob,
};
