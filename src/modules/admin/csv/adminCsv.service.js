const csv = require("csv-parser");
const XLSX = require("xlsx");
const streamifier = require("streamifier");
const openai = require("../../../config/openai");
const pLimit = require("p-limit").default;

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
/// AI HEADER MAPPING (IMPROVED)
////////////////////////////////////////////////////////////

async function getHeaderMapping(headers) {
  const cacheKey = generateHeaderKey(headers);

  if (headerCache.has(cacheKey)) {
    return headerCache.get(cacheKey);
  }

  try {
    const prompt = `
You are an expert ATS parser.

Map ANY weird/unstructured CSV headers to closest matching fields.

Allowed fields:
${STANDARD_FIELDS.join(", ")}

Rules:
- Map even vague headers (e.g. "where do you live" → currentLocation)
- NEVER skip useful columns
- If unsure, choose closest logical match

Return JSON:
{
  "csv_column": "field"
}

Headers:
${JSON.stringify(headers)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You map CSV headers smartly." },
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/\D/g, "").slice(-10);
}

////////////////////////////////////////////////////////////
/// PROCESS FILE (STREAM SAFE)
////////////////////////////////////////////////////////////

async function processFile(file) {
  if (!file || !file.buffer) {
    throw new Error("Invalid file");
  }

  if (file.buffer.length === 0) {
    throw new Error("Empty file uploaded");
  }

  const isCSV = file.originalname.endsWith(".csv");

  let headers = [];
  let normalizedMapping = {};
  let isFirstRow = true;

  const seen = new Set();
  const limit = pLimit(10);
  const results = [];

  let rowIndex = 0;

  async function processRow(row) {
    const i = rowIndex++;

    try {
      let mapped = {};

      ////////////////////////////////////////////////////////////
      /// AI MAPPING
      ////////////////////////////////////////////////////////////

      for (const key of headers) {
        const target = normalizedMapping[normalizeHeaderKey(key)];

        if (target && STANDARD_FIELDS.includes(target)) {
          mapped[target] = row[key];
        }
      }

      ////////////////////////////////////////////////////////////
      /// FALLBACK
      ////////////////////////////////////////////////////////////

      const fallback = mapRow(row);
      for (const key in fallback) {
        if (!mapped[key]) mapped[key] = fallback[key];
      }

      ////////////////////////////////////////////////////////////
      /// CLEAN
      ////////////////////////////////////////////////////////////

      Object.keys(mapped).forEach((k) => {
        const val = mapped[k];

        if (val === undefined || val === null) {
          delete mapped[k];
          return;
        }

        const trimmed = val.toString().trim();

        if (trimmed === "") {
          delete mapped[k]; // 🔥 remove empty fields
        } else {
          mapped[k] = trimmed;
        }
      });

      console.log("FINAL MAPPED:", mapped);
      const email = isValidEmail(mapped.email)
        ? mapped.email.toLowerCase()
        : undefined;

      const phone = normalizePhone(mapped.phone) || undefined;

      ////////////////////////////////////////////////////////////
      /// DUPLICATE CHECK
      ////////////////////////////////////////////////////////////

      const uniqueKey = email || phone;

      if (uniqueKey) {
        if (seen.has(uniqueKey)) {
          return {
            row: i + 1,
            status: "duplicate",
            reason: "Duplicate in file",
            name: mapped.name || null,
            email: email || null,
            phone: phone || null,
          };
        }
        seen.add(uniqueKey);
      }

      ////////////////////////////////////////////////////////////
      /// VALIDATION
      ////////////////////////////////////////////////////////////

      if (!email && !phone) {
        return {
          row: i + 1,
          status: "skipped",
          reason: "No email/phone",
          name: mapped.name || null,
        };
      }

      ////////////////////////////////////////////////////////////
      /// DB CALL
      ////////////////////////////////////////////////////////////

      const result = await candidateService.createOrFindCandidate(
        mapped,
        "ADMIN_UPLOAD",
      );

      if (!result) {
        return {
          row: i + 1,
          status: "skipped",
          reason: "Invalid candidate",
        };
      }

      const candidate = result.candidate;

      return {
        row: i + 1,
        status: result.isNew ? "created" : "duplicate",
        candidateId: candidate.id,
        name: candidate.name || mapped.name || null,
        email: candidate.email || email || null,
        phone: candidate.phone || phone || null,
        experience: candidate.totalExperience ?? null,
        currentCompany: candidate.currentCompany ?? null,
        currentDesignation: candidate.currentDesignation ?? null,
        skills: candidate.skills ?? null,
      };
    } catch (err) {
      return {
        row: i + 1,
        status: "error",
        error: err.message,
      };
    }
  }

  ////////////////////////////////////////////////////////////
  /// CSV STREAM
  ////////////////////////////////////////////////////////////

  try {
    if (isCSV) {
      const stream = streamifier.createReadStream(file.buffer).pipe(csv());

      await new Promise((resolve, reject) => {
        stream
          .on("data", async (row) => {
            stream.pause();

            if (isFirstRow) {
              headers = Object.keys(row).map((h) => h.trim());

              const aiMapping = await getHeaderMapping(headers);

              if (aiMapping) {
                for (const key in aiMapping) {
                  normalizedMapping[normalizeHeaderKey(key)] = aiMapping[key];
                }
              }

              isFirstRow = false;
            }

            const result = await limit(() => processRow(row));
            results.push(result);

            stream.resume();
          })
          .on("end", resolve)
          .on("error", reject);
      });
    } else {
      ////////////////////////////////////////////////////////////
      /// XLS / XLSX
      ////////////////////////////////////////////////////////////

      const workbook = XLSX.read(file.buffer, { type: "buffer" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) throw new Error("Empty Excel file");

      headers = Object.keys(rows[0]);

      const aiMapping = await getHeaderMapping(headers);

      if (aiMapping) {
        for (const key in aiMapping) {
          normalizedMapping[normalizeHeaderKey(key)] = aiMapping[key];
        }
      }

      for (const row of rows) {
        const result = await limit(() => processRow(row));
        results.push(result);
      }
    }

    ////////////////////////////////////////////////////////////
    /// SUMMARY
    ////////////////////////////////////////////////////////////

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      duplicate: results.filter((r) => r.status === "duplicate").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      error: results.filter((r) => r.status === "error").length,
    };

    return { summary, results };
  } catch (err) {
    throw new Error("Invalid or corrupted file");
  }
}

module.exports = {
  processFile,
};
