const prisma = require("../../config/prisma");
const fs = require("fs");
const csv = require("csv-parser");
const openai = require("../../config/openai");
const { getEmbedding } = require("../../utils/embedding");

////////////////////////////////////////////////////////
// STANDARD FIELDS
////////////////////////////////////////////////////////

const STANDARD_JOB_FIELDS = [
  "jrCode",
  "title",
  "description",
  "jd",
  "companyName",
  "department",
  "location",
  "minExperience",
  "maxExperience",
  "salaryMin",
  "salaryMax",
  "openings",
  "skills",
  "education",
  "status",
  "requestDate",
  "closureDate",
];

////////////////////////////////////////////////////////
// HEADER CACHE
////////////////////////////////////////////////////////

const headerCache = new Map();

function generateHeaderKey(headers) {
  return headers
    .map((h) => h.toLowerCase().trim())
    .sort()
    .join("|");
}

////////////////////////////////////////////////////////
// AI HEADER MAPPING
////////////////////////////////////////////////////////

async function getHeaderMapping(headers) {
  const cacheKey = generateHeaderKey(headers);

  if (headerCache.has(cacheKey)) {
    return headerCache.get(cacheKey);
  }

  try {
    const prompt = `
Map CSV headers to job fields.

Allowed fields:
${STANDARD_JOB_FIELDS.join(", ")}

Return JSON:
{
  "csv_column_name": "job_field"
}

Headers:
${JSON.stringify(headers)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You map CSV headers to job fields." },
        { role: "user", content: prompt },
      ],
    });

    const mapping = JSON.parse(completion.choices[0].message.content);

    headerCache.set(cacheKey, mapping);

    return mapping;
  } catch (error) {
    console.error("AI header mapping failed:", error);
    return null;
  }
}

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

function normalizeSkills(skills) {
  if (!skills) return null;

  return skills
    .split(/[,|]/)
    .map((s) =>
      s.toLowerCase().replace(/\.js/g, "").replace(/\s+/g, " ").trim(),
    )
    .filter(Boolean)
    .join(", ");
}

////////////////////////////////////////////////////////
// CREATE JOB
////////////////////////////////////////////////////////

async function createJob(data) {
  ////////////////////////////////////////////////////////////
  // NORMALIZE SKILLS
  ////////////////////////////////////////////////////////////

  const normalizedSkills = normalizeSkills(data.skills);

  ////////////////////////////////////////////////////////////
  // PREPARE EMBEDDING TEXT (CHEAP + SHORT)
  ////////////////////////////////////////////////////////////

  const jobText = `
${data.title || ""}
${data.description || ""}
${normalizedSkills || ""}
`;

  let embedding = null;

  try {
    embedding = await getEmbedding(jobText);
  } catch (err) {
    console.error("Job embedding failed:", err.message);
  }

  ////////////////////////////////////////////////////////////

  return prisma.job.create({
    data: {
      jrCode: safeString(data.jrCode),
      title: safeString(data.title),
      description: safeString(data.description),
      jd: safeString(data.jd),
      companyName: safeString(data.companyName),
      department: safeString(data.department),
      location: safeString(data.location),

      minExperience: safeInt(data.minExperience),
      maxExperience: safeInt(data.maxExperience),

      salaryMin: safeInt(data.salaryMin),
      salaryMax: safeInt(data.salaryMax),

      openings: safeInt(data.openings) || 1,

      ////////////////////////////////////////////////////////////
      // ✅ UPDATED SKILLS
      ////////////////////////////////////////////////////////////

      skills: normalizedSkills,
      skillsArray: normalizedSkills
        ? normalizedSkills.split(",").map((s) => s.trim().toLowerCase())
        : [],

      ////////////////////////////////////////////////////////////

      education: safeString(data.education),

      status: normalizeStatus(data.status),

      source: data.source || "MANUAL",

      requestDate: safeDate(data.requestDate),
      closureDate: safeDate(data.closureDate),

      extraData: data.extraData || null,

      ////////////////////////////////////////////////////////////
      // ✅ ADD THIS (IMPORTANT)
      ////////////////////////////////////////////////////////////

      embedding,

      ////////////////////////////////////////////////////////////

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
        select: { id: true, name: true },
      },
      _count: {
        select: { applications: true },
      },
    },
  });
}

////////////////////////////////////////////////////////
// CSV UPLOAD (AI + FALLBACK)
////////////////////////////////////////////////////////

async function createJobsFromCSV(filePath, createdById) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const jobs = [];
    const errors = [];

    let totalRows = 0;
    let skipped = 0;
    let duplicates = 0;

    const seenJobs = new Set();

    function normalizeHeader(header) {
      return header
        ?.toString()
        .trim()
        .toLowerCase()
        .replace(/[_\-\/\.]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s/g, "");
    }

    function getField(row, possibleNames, usedFields) {
      for (const key in row) {
        const normalizedKey = normalizeHeader(key);

        for (const name of possibleNames) {
          if (normalizedKey === normalizeHeader(name)) {
            usedFields.add(normalizedKey);
            return row[key];
          }
        }
      }
      return null;
    }

    function extractExtraData(row, usedFields) {
      const extra = {};
      for (const key in row) {
        const normalized = normalizeHeader(key);
        if (!usedFields.has(normalized)) {
          extra[key] = row[key];
        }
      }
      return Object.keys(extra).length ? extra : null;
    }

    ////////////////////////////////////////////////////////

    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header?.trim() }))
      .on("data", (row) => {
        rows.push(row);
      })

      .on("end", async () => {
        try {
          if (rows.length === 0) {
            return resolve({ success: false, summary: {}, errors: [] });
          }

          const headers = Object.keys(rows[0] || {});
          const aiMapping = await getHeaderMapping(headers);
          const normalizedSkills = normalizeSkills(aiMapped.skills);

          const normalizedMapping = {};

          if (aiMapping) {
            for (const key in aiMapping) {
              normalizedMapping[key.toLowerCase().replace(/\s+/g, "")] =
                aiMapping[key];
            }
          }

          ////////////////////////////////////////////////////////
          // PROCESS ROWS
          ////////////////////////////////////////////////////////

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            totalRows++;

            const usedFields = new Set();

            try {
              ////////////////////////////////////////////////////
              // AI MAPPING
              ////////////////////////////////////////////////////

              const aiMapped = {};

              for (const key in row) {
                const normalizedKey = key.toLowerCase().replace(/\s+/g, "");

                const target = normalizedMapping[normalizedKey];

                if (target && STANDARD_JOB_FIELDS.includes(target)) {
                  aiMapped[target] = row[key];
                }
              }

              ////////////////////////////////////////////////////
              // FINAL JOB OBJECT
              ////////////////////////////////////////////////////

              const job = {
                jrCode:
                  safeString(aiMapped.jrCode) ||
                  safeString(getField(row, ["jrcode", "jobcode"], usedFields)),

                title:
                  safeString(aiMapped.title) ||
                  safeString(
                    getField(
                      row,
                      ["title", "job title", "designation", "role"],
                      usedFields,
                    ),
                  ),

                description: safeString(aiMapped.description),
                jd: safeString(aiMapped.jd),

                companyName:
                  safeString(aiMapped.companyName) ||
                  safeString(getField(row, ["company", "client"], usedFields)),

                location:
                  safeString(aiMapped.location) ||
                  safeString(getField(row, ["location", "city"], usedFields)),

                department:
                  safeString(aiMapped.department) ||
                  safeString(getField(row, ["department"], usedFields)),

                minExperience: safeInt(aiMapped.minExperience),
                maxExperience: safeInt(aiMapped.maxExperience),

                salaryMin: safeInt(aiMapped.salaryMin),
                salaryMax: safeInt(aiMapped.salaryMax),

                openings: safeInt(aiMapped.openings) || 1,

                skills: normalizedSkills,
                skillsArray: normalizedSkills
                  ? normalizedSkills
                      .split(",")
                      .map((s) => s.trim().toLowerCase())
                  : [],
                education: safeString(aiMapped.education),

                status: normalizeStatus(aiMapped.status),

                requestDate: safeDate(aiMapped.requestDate),
                closureDate: safeDate(aiMapped.closureDate),

                source: "CSV_UPLOAD",

                createdById,
              };

              job.extraData = extractExtraData(row, usedFields);

              ////////////////////////////////////////////////////
              // VALIDATION
              ////////////////////////////////////////////////////

              if (!job.title) {
                skipped++;
                errors.push({
                  row: totalRows,
                  error: "Missing job title",
                });
                continue;
              }

              ////////////////////////////////////////////////////
              // DUPLICATE CHECK
              ////////////////////////////////////////////////////

              const duplicateKey =
                `${job.title}-${job.companyName}-${job.location}`.toLowerCase();

              if (seenJobs.has(duplicateKey)) {
                duplicates++;
                errors.push({
                  row: totalRows,
                  error: "Duplicate job in CSV",
                });
                continue;
              }

              seenJobs.add(duplicateKey);
              jobs.push(job);
            } catch (err) {
              skipped++;
              errors.push({
                row: totalRows,
                error: err.message,
              });
            }
          }

          ////////////////////////////////////////////////////////
          // DB INSERT
          ////////////////////////////////////////////////////////

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
              duplicates,
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
// GET JOB BY ID
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
            select: { name: true, email: true },
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
