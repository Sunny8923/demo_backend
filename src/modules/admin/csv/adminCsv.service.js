const fs = require("fs");
const csv = require("csv-parser");
const openai = require("../../../config/openai");

// ✅ shared candidate service
const candidateService = require("../services/candidate.service");

////////////////////////////////////////////////////////////
/// STANDARD FIELDS
////////////////////////////////////////////////////////////

function normalizeHeaderKey(key) {
  return key.toLowerCase().replace(/\s+/g, "").trim();
}

const STANDARD_FIELDS = [
  "name",
  "email",
  "phone",

  "currentLocation",
  "preferredLocations",
  "hometown",
  "pincode",

  "totalExperience",
  "currentCompany",
  "currentDesignation",
  "department",
  "industry",
  "skills",
  "currentSalary",
  "expectedSalary",
  "noticePeriodDays",

  "highestQualification",

  "resumeUrl",
];

////////////////////////////////////////////////////////////
/// CACHE
////////////////////////////////////////////////////////////

const headerCache = new Map();

function generateHeaderKey(headers) {
  return headers
    .map((h) => h.toLowerCase().trim())
    .sort()
    .join("|");
}

////////////////////////////////////////////////////////////
/// AI HEADER MAPPING
////////////////////////////////////////////////////////////

async function getHeaderMapping(headers) {
  const cacheKey = generateHeaderKey(headers);

  if (headerCache.has(cacheKey)) {
    return headerCache.get(cacheKey);
  }

  try {
    const prompt = `
You are an expert ATS parser.

Map CSV headers to these fields only:
${STANDARD_FIELDS.join(", ")}

Return JSON:
{
  "csv_column_name": "candidate_field"
}

Headers:
${JSON.stringify(headers)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You map CSV headers." },
        { role: "user", content: prompt },
      ],
    });

    const mapping = JSON.parse(completion.choices[0].message.content);

    headerCache.set(cacheKey, mapping);

    return mapping;
  } catch (error) {
    console.error("AI mapping failed:", error);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// FALLBACK MAP
////////////////////////////////////////////////////////////

const FIELD_MAP = {
  name: ["name", "full_name", "candidate_name"],
  email: ["email", "email_id"],
  phone: ["phone", "mobile", "contact"],

  currentLocation: ["location", "city"],
  preferredLocations: ["preferred_location"],
  hometown: ["hometown"],
  pincode: ["pincode", "zip"],

  totalExperience: ["experience", "exp"],
  currentCompany: ["company"],
  currentDesignation: ["designation", "role"],
  department: ["department"],
  industry: ["industry"],

  skills: ["skills", "skillset"],

  currentSalary: ["ctc"],
  expectedSalary: ["expected_ctc"],

  noticePeriodDays: ["notice_period"],

  highestQualification: ["education", "degree"],

  resumeUrl: ["resume"],
};

////////////////////////////////////////////////////////////
/// HELPERS
////////////////////////////////////////////////////////////

function normalizeKey(key) {
  return key.toLowerCase().replace(/\s+/g, "_").trim();
}

function mapRow(row) {
  const mapped = {};

  for (const field in FIELD_MAP) {
    const aliases = FIELD_MAP[field];

    for (const key in row) {
      const normalizedKey = normalizeKey(key);

      if (aliases.includes(normalizedKey)) {
        mapped[field] = row[key];
        break;
      }
    }
  }

  return mapped;
}

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/\D/g, "").slice(-10);
}

////////////////////////////////////////////////////////////
/// PROCESS CSV
////////////////////////////////////////////////////////////

async function processCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", async () => {
        try {
          if (results.length === 0) {
            return resolve({ summary: {}, results: [] });
          }

          const headers = Object.keys(results[0]).map((h) => h.trim());

          const aiMapping = await getHeaderMapping(headers);

          const normalizedMapping = {};

          if (aiMapping) {
            for (const key in aiMapping) {
              normalizedMapping[normalizeHeaderKey(key)] = aiMapping[key];
            }
          }

          const processed = [];

          ////////////////////////////////////////////////////////////
          /// LOOP
          ////////////////////////////////////////////////////////////

          for (let i = 0; i < results.length; i++) {
            const row = results[i];

            try {
              let mapped = {};

              ////////////////// AI //////////////////

              if (Object.keys(normalizedMapping).length > 0) {
                for (const key of headers) {
                  const target = normalizedMapping[normalizeHeaderKey(key)];

                  if (target && STANDARD_FIELDS.includes(target)) {
                    mapped[target] = row[key];
                  }
                }
              }

              ////////////////// FALLBACK //////////////////

              const fallback = mapRow(row);

              for (const key in fallback) {
                if (!mapped[key]) mapped[key] = fallback[key];
              }

              ////////////////// CLEAN //////////////////

              Object.keys(mapped).forEach((k) => {
                mapped[k] = mapped[k]?.toString().trim() || null;
              });

              const email = isValidEmail(mapped.email)
                ? mapped.email
                : undefined;

              const phone = normalizePhone(mapped.phone) || undefined;

              ////////////////// VALIDATION //////////////////

              if (!email && !phone) {
                processed.push({
                  row: i + 1,
                  status: "skipped",
                  reason: "No email/phone",
                });
                continue;
              }

              ////////////////// CREATE //////////////////

              const result = await candidateService.createOrFindCandidate(
                mapped,
                "ADMIN_CSV_UPLOAD",
              );

              if (!result) {
                processed.push({
                  row: i + 1,
                  status: "skipped",
                  reason: "Invalid candidate",
                });
              } else {
                processed.push({
                  row: i + 1,
                  status: result.isNew ? "created" : "duplicate",
                  candidateId: result.candidate.id,
                });
              }
            } catch (err) {
              processed.push({
                row: i + 1,
                status: "error",
                error: err.message,
                data: row,
              });
            }
          }

          ////////////////////////////////////////////////////////////
          /// SUMMARY
          ////////////////////////////////////////////////////////////

          const summary = {
            total: processed.length,
            created: processed.filter((r) => r.status === "created").length,
            duplicate: processed.filter((r) => r.status === "duplicate").length,
            skipped: processed.filter((r) => r.status === "skipped").length,
            error: processed.filter((r) => r.status === "error").length,
          };

          ////////////////////////////////////////////////////////////
          /// CLEANUP
          ////////////////////////////////////////////////////////////

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          resolve({ summary, results: processed });
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject);
  });
}

module.exports = {
  processCSV,
};
