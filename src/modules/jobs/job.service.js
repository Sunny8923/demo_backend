const prisma = require("../../config/prisma");
const fs = require("fs");
const csv = require("csv-parser");

////////////////////////////////////////////////////////
// SAFE HELPERS
////////////////////////////////////////////////////////

function safeString(value) {
  if (value === undefined || value === null) return null;

  const str = value.toString().trim();

  return str.length === 0 ? null : str;
}

function safeInt(value) {
  if (!value) return null;

  const num = parseInt(value.toString().replace(/[^0-9]/g, ""));

  return isNaN(num) ? null : num;
}

function safeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(status) {
  if (!status) return "OPEN";

  const allowed = ["OPEN", "CLOSED", "ON_HOLD", "CANCELLED"];

  const normalized = status.toString().trim().toUpperCase();

  return allowed.includes(normalized) ? normalized : "OPEN";
}

////////////////////////////////////////////////////////
// CREATE JOB
////////////////////////////////////////////////////////

async function createJob(data) {
  return prisma.job.create({
    data: {
      jrCode: safeString(data.jrCode),

      title: safeString(data.title),

      description: safeString(data.description),

      companyName: safeString(data.companyName),

      department: safeString(data.department),

      location: safeString(data.location),

      minExperience: safeInt(data.minExperience),

      maxExperience: safeInt(data.maxExperience),

      salaryMin: safeInt(data.salaryMin),

      salaryMax: safeInt(data.salaryMax),

      openings: safeInt(data.openings) || 1,

      skills: safeString(data.skills),

      education: safeString(data.education),

      status: normalizeStatus(data.status),

      requestDate: safeDate(data.requestDate),

      closureDate: safeDate(data.closureDate),

      createdById: data.createdById,
    },
  });
}

////////////////////////////////////////////////////////
// GET ALL JOBS
////////////////////////////////////////////////////////

async function getAllJobs() {
  return prisma.job.findMany({
    orderBy: { createdAt: "desc" },

    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },

      _count: {
        select: {
          applications: true,
        },
      },
    },
  });
}

////////////////////////////////////////////////////////
// HIGH-TOLERANCE CSV UPLOAD
////////////////////////////////////////////////////////

async function createJobsFromCSV(filePath, createdById) {
  return new Promise((resolve, reject) => {
    const jobs = [];
    const errors = [];

    let totalRows = 0;
    let skipped = 0;

    fs.createReadStream(filePath)

      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim(),
        }),
      )

      .on("data", (row) => {
        totalRows++;

        try {
          const get = (...keys) => {
            for (const key of keys) {
              if (row[key] && row[key].toString().trim()) {
                return row[key];
              }
            }

            return null;
          };

          const job = {
            jrCode: get("JR Code", "Job Code", "Code"),

            title: get("Designation", "Title", "Job Title", "Position"),

            companyName: get("Client Name", "Company", "Company Name"),

            location: get("Location", "City", "District"),

            department: get("Department", "Vertical"),

            description: get("Description"),

            skills: get("Skills"),

            education: get("Education"),

            minExperience: safeInt(get("Min Experience")),

            maxExperience: safeInt(get("Max Experience")),

            salaryMin: safeInt(get("Salary Min")),

            salaryMax: safeInt(get("Salary Max")),

            openings: safeInt(get("Openings", "No Of Openings")) || 1,

            status: normalizeStatus(get("Status")),

            requestDate: safeDate(get("Request Date")),

            closureDate: safeDate(get("Closure Date")),

            createdById,
          };

          if (!job.title || !job.companyName || !job.location) {
            skipped++;

            errors.push({
              row: totalRows,
              error: "Missing required fields",
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
              },

              errors,
            });
          }

          const result = await prisma.job.createMany({
            data: jobs,

            skipDuplicates: true,
          });

          resolve({
            success: true,

            summary: {
              totalRows,

              validRows: jobs.length,

              created: result.count,

              skipped,

              failed: errors.length,
            },

            errors,
          });
        } catch (err) {
          reject(err);
        }
      })

      .on("error", reject);
  });
}

////////////////////////////////////////////////////////
// GET JOB BY ID (FIXED)
////////////////////////////////////////////////////////

async function getJobById(id) {
  const job = await prisma.job.findUnique({
    where: { id },

    include: {
      createdBy: true,

      applications: {
        select: {
          id: true,

          pipelineStage: true,

          finalStatus: true,

          createdAt: true,

          candidate: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!job) throw new Error("Job not found");

  return job;
}

////////////////////////////////////////////////////////
// UPDATE JOB
////////////////////////////////////////////////////////

async function updateJob(id, data) {
  return prisma.job.update({
    where: { id },

    data,
  });
}

////////////////////////////////////////////////////////
// DELETE JOB
////////////////////////////////////////////////////////

async function deleteJob(id) {
  return prisma.job.delete({
    where: { id },
  });
}

////////////////////////////////////////////////////////

module.exports = {
  createJob,
  getAllJobs,
  createJobsFromCSV,
  getJobById,
  updateJob,
  deleteJob,
};
