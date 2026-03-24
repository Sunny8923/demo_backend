const csv = require("csv-parser");
const openai = require("../../../config/openai");
const pLimit = require("p-limit").default;
const XLSX = require("xlsx");
const stream = require("stream");

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
/// AI HEADER MAPPING (UNCHANGED)
////////////////////////////////////////////////////////////

async function getHeaderMapping(headers) {
  const cacheKey = generateHeaderKey(headers);

  if (headerCache.has(cacheKey)) {
    return headerCache.get(cacheKey);
  }

  try {
    const prompt = `
Map CSV headers to these fields only:
${STANDARD_FIELDS.join(", ")}

Return JSON:
{
  "csv_column_name": "candidate_field"
}

Headers:
${JSON.stringify(headers)}
`;

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You map CSV headers." },
          { role: "user", content: prompt },
        ],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), 2000),
      ),
    ]);

    const mapping = JSON.parse(completion.choices[0].message.content);

    headerCache.set(cacheKey, mapping);

    return mapping;
  } catch (error) {
    console.error("AI mapping failed:", error.message);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// FIELD MAP (UNCHANGED - YOUR VERSION)
////////////////////////////////////////////////////////////

const FIELD_MAP = {
  name: ["name", "full_name", "candidate_name"],
  email: ["email", "email_id", "emailid"],
  phone: ["phone", "mobile", "contact", "phone_number"],
  currentLocation: ["location", "city", "current_location"],
  preferredLocations: ["preferred_location", "preferred_locations"],
  hometown: ["hometown", "home_town", "home_town_city"],
  pincode: ["pincode", "zip", "pin_code"],
  totalExperience: ["experience", "exp", "total_experience"],
  currentCompany: ["company", "curr_company_name"],
  currentDesignation: ["designation", "role", "curr_company_designation"],
  department: ["department"],
  industry: ["industry"],
  skills: ["skills", "skillset", "key_skills"],
  currentSalary: ["ctc", "salary", "annual_salary"],
  expectedSalary: ["expected_ctc", "expected_salary"],
  noticePeriodDays: [
    "notice_period",
    "availability_to_join",
    "notice_period_availability_to_join",
  ],
  highestQualification: ["education", "degree"],
  resumeUrl: ["resume"],
};

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^\w]/g, "_").replace(/_+/g, "_").trim();
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
/// FILE PARSERS
////////////////////////////////////////////////////////////

async function parseCSVBuffer(buffer) {
  const results = [];

  const readable = new stream.Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);

  return new Promise((resolve, reject) => {
    readable
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

////////////////////////////////////////////////////////////
/// MAIN FUNCTION
////////////////////////////////////////////////////////////

async function processCSVBuffer(fileBuffer, fileName = "") {
  let results = [];

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    results = parseExcelBuffer(fileBuffer);
  } else {
    results = await parseCSVBuffer(fileBuffer);
  }

  if (results.length === 0) {
    return { summary: {}, results: [] };
  }

  const headers = Object.keys(results[0]).map((h) => h.trim());

  ////////////////////////////////////////////////////////////
  /// AI (NON-BLOCKING + FAST FALLBACK)
  ////////////////////////////////////////////////////////////

  let normalizedMapping = {};

  let aiMapping = null;

  try {
    aiMapping = await Promise.race([
      getHeaderMapping(headers),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)), // ⚡ max 500ms wait
    ]);
  } catch (e) {
    aiMapping = null;
  }

  if (aiMapping) {
    for (const key in aiMapping) {
      normalizedMapping[normalizeHeaderKey(key)] = aiMapping[key];
    }
  }

  ////////////////////////////////////////////////////////////
  /// DUPLICATE TRACKING
  ////////////////////////////////////////////////////////////

  const seen = new Set();

  ////////////////////////////////////////////////////////////
  /// ⚡ INCREASED CONCURRENCY
  ////////////////////////////////////////////////////////////

  const limit = pLimit(30);

  async function processRow(row, i) {
    try {
      let mapped = {};

      ////////////////////////////////////////////////////////////
      /// FALLBACK FIRST
      ////////////////////////////////////////////////////////////

      const fallback = mapRow(row);
      mapped = { ...fallback };

      ////////////////////////////////////////////////////////////
      /// AI (FILL GAPS ONLY)
      ////////////////////////////////////////////////////////////

      if (Object.keys(normalizedMapping).length > 0) {
        for (const key of headers) {
          const target = normalizedMapping[normalizeHeaderKey(key)];

          if (target && STANDARD_FIELDS.includes(target) && !mapped[target]) {
            mapped[target] = row[key];
          }
        }
      }

      ////////////////////////////////////////////////////////////
      /// CLEAN
      ////////////////////////////////////////////////////////////

      Object.keys(mapped).forEach((k) => {
        mapped[k] = mapped[k]?.toString().trim() || null;
      });

      const email = isValidEmail(mapped.email)
        ? mapped.email.toLowerCase()
        : undefined;

      const phone = normalizePhone(mapped.phone) || undefined;

      ////////////////////////////////////////////////////////////
      /// DUPLICATE
      ////////////////////////////////////////////////////////////

      const uniqueKey = email || phone;

      if (uniqueKey) {
        if (seen.has(uniqueKey)) {
          return {
            row: i + 1,
            status: "duplicate_csv",
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
        };
      }

      ////////////////////////////////////////////////////////////
      /// DB CALL
      ////////////////////////////////////////////////////////////

      const result = await candidateService.createOrFindCandidate(
        mapped,
        "ADMIN_CSV_UPLOAD",
      );

      if (!result) {
        return {
          row: i + 1,
          status: "skipped",
        };
      }

      return {
        row: i + 1,
        status: result.isNew ? "created" : "duplicate_db",
      };
    } catch (err) {
      return {
        row: i + 1,
        status: "error",
      };
    }
  }

  ////////////////////////////////////////////////////////////
  /// PROCESS
  ////////////////////////////////////////////////////////////

  const processed = await Promise.all(
    results.map((row, i) => limit(() => processRow(row, i))),
  );
  ////////////////////////////////////////////////////////////
  /// SUMMARY
  ////////////////////////////////////////////////////////////

  const summary = {
    total: processed.length,
    created: processed.filter((r) => r.status === "created").length,
    duplicate: processed.filter(
      (r) => r.status === "duplicate_db" || r.status === "duplicate_csv",
    ).length,
    skipped: processed.filter((r) => r.status === "skipped").length,
    error: processed.filter((r) => r.status === "error").length,
  };

  return { summary, results: processed };
}

module.exports = {
  processCSVBuffer,
};
