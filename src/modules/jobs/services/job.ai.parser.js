const openai = require("../../../config/openai");

////////////////////////////////////////////////////////////
/// STANDARD JOB FIELDS
////////////////////////////////////////////////////////////

const STANDARD_JOB_FIELDS = [
  "title",
  "companyName",
  "location",
  "department",

  "minExperience",
  "maxExperience",

  "salaryMin",
  "salaryMax",

  "skills",
  "education",

  "description",
];

////////////////////////////////////////////////////////////
/// HELPERS
////////////////////////////////////////////////////////////

function safeNumber(value) {
  if (value === null || value === undefined) return null;

  const num = parseFloat(value.toString().replace(/[^0-9.]/g, ""));
  return isNaN(num) ? null : num;
}

function normalizeSkills(value) {
  if (!value) return null;

  if (typeof value !== "string") {
    value = value?.toString?.() || "";
  }

  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function safeString(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") return value.trim();

  return value?.toString?.().trim() || null;
}

////////////////////////////////////////////////////////////
/// OPENAI CALL
////////////////////////////////////////////////////////////

async function callOpenAI(prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert ATS job parser. Extract structured job data strictly in JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error("OpenAI call failed:", err.message);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// MAIN PARSER
////////////////////////////////////////////////////////////

async function parseJobFromText(text) {
  try {
    if (!text || text.length < 200) return null;

    const prompt = `
Extract structured job data from the job description below.

IMPORTANT RULES:
- Return ONLY valid JSON
- Use ONLY these fields:
${STANDARD_JOB_FIELDS.join(", ")}

- If value not found → return null
- Do NOT guess company name if not clearly present
- Extract experience in YEARS (numbers only)
- Extract salary as numbers (no currency symbols)
- Skills should be comma-separated string
- Keep description short (max 500 words summary)

Job Description:
"""${text.slice(0, 12000)}"""
`;

    ////////////////////////////////////////////////////////////
    /// RETRY
    ////////////////////////////////////////////////////////////

    for (let i = 0; i < 2; i++) {
      const result = await callOpenAI(prompt);

      if (result && typeof result === "object") {
        const normalized = {};

        for (const field of STANDARD_JOB_FIELDS) {
          let value = result[field];

          ////////////////////////////////////////////
          /// NULL SAFE
          ////////////////////////////////////////////

          if (value === undefined || value === null || value === "") {
            normalized[field] = null;
            continue;
          }

          ////////////////////////////////////////////
          /// NUMBERS
          ////////////////////////////////////////////

          if (
            field === "minExperience" ||
            field === "maxExperience" ||
            field === "salaryMin" ||
            field === "salaryMax"
          ) {
            normalized[field] = safeNumber(value);
            continue;
          }

          ////////////////////////////////////////////
          /// SKILLS FIX
          ////////////////////////////////////////////

          if (field === "skills") {
            normalized[field] = normalizeSkills(value);
            continue;
          }

          ////////////////////////////////////////////
          /// STRING SAFE
          ////////////////////////////////////////////

          normalized[field] = safeString(value);
        }

        return normalized;
      }
    }

    return null;
  } catch (error) {
    console.error("Job AI parsing failed:", error);
    return null;
  }
}

////////////////////////////////////////////////////////////

module.exports = {
  parseJobFromText,
};
