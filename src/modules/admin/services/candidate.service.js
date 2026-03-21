const prisma = require("../../../config/prisma");
const {
  getEmbedding,
  buildCandidateEmbeddingText,
} = require("../../../utils/embedding");
const {
  cleanExperience,
  calculateTotalExperience,
} = require("../../../utils/experience");

////////////////////////////////////////////////////////////
/// HELPERS
////////////////////////////////////////////////////////////

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/\D/g, "").slice(-10);
}

function parseExperience(val) {
  if (!val) return null;

  const match = val.toString().match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function parseSalary(val) {
  if (!val) return null;

  let str = val.toString().toLowerCase().replace(/,/g, "").trim();

  if (str.includes("lpa") || str.includes("lac")) {
    const num = parseFloat(str);
    return isNaN(num) ? null : num * 100000;
  }

  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function parseNoticePeriod(val) {
  if (!val) return null;

  const str = val.toString().toLowerCase();

  if (str.includes("immediate")) return 0;

  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : null;
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

function resolveTotalExperience(data) {
  ////////////////////////////////////////////////////////////
  /// 1. TRY STRUCTURED EXPERIENCE (BEST SOURCE)
  ////////////////////////////////////////////////////////////

  if (Array.isArray(data.experience) && data.experience.length > 0) {
    const cleaned = cleanExperience(data.experience);
    const calculated = calculateTotalExperience(cleaned);

    if (calculated !== null) {
      return calculated;
    }
  }

  ////////////////////////////////////////////////////////////
  /// 2. FALLBACK → AI VALUE
  ////////////////////////////////////////////////////////////

  const parsed = parseExperience(data.totalExperience);

  if (parsed !== null) return parsed;

  ////////////////////////////////////////////////////////////
  /// 3. FINAL FALLBACK
  ////////////////////////////////////////////////////////////

  return null;
}

////////////////////////////////////////////////////////////
/// MERGE HELPERS
////////////////////////////////////////////////////////////

function mergeValues(oldVal, newVal) {
  if (!oldVal && newVal) return newVal;
  return oldVal;
}

function mergeSkills(oldSkills, newSkills) {
  const oldArr = oldSkills ? oldSkills.split(",") : [];
  const newArr = newSkills ? newSkills.split(",") : [];

  const merged = [...new Set([...oldArr, ...newArr])];

  return merged.filter(Boolean).join(", ");
}

////////////////////////////////////////////////////////////
/// BUILD UPDATE DATA
////////////////////////////////////////////////////////////

function buildUpdateData(existing, data, extra) {
  const mergedSkills = mergeSkills(
    existing.skills,
    normalizeSkills(data.skills),
  );

  return {
    name: mergeValues(existing.name, data.name),

    currentLocation: mergeValues(
      existing.currentLocation,
      data.currentLocation,
    ),
    preferredLocations: mergeValues(
      existing.preferredLocations,
      data.preferredLocations,
    ),
    hometown: mergeValues(existing.hometown, data.hometown),
    pincode: mergeValues(existing.pincode, data.pincode),

    totalExperience: existing.totalExperience ?? resolveTotalExperience(data),

    currentCompany: mergeValues(existing.currentCompany, data.currentCompany),
    currentDesignation: mergeValues(
      existing.currentDesignation,
      data.currentDesignation,
    ),
    department: mergeValues(existing.department, data.department),
    industry: mergeValues(existing.industry, data.industry),

    ////////////////////////////////////////////////////////////
    /// SKILLS
    ////////////////////////////////////////////////////////////

    skills: mergedSkills,
    skillsArray: mergedSkills
      ? mergedSkills.split(",").map((s) => s.trim().toLowerCase())
      : existing.skillsArray || [],

    ////////////////////////////////////////////////////////////

    currentSalary: existing.currentSalary ?? parseSalary(data.currentSalary),
    expectedSalary: existing.expectedSalary ?? parseSalary(data.expectedSalary),

    noticePeriodDays:
      existing.noticePeriodDays ?? parseNoticePeriod(data.noticePeriodDays),

    highestQualification: mergeValues(
      existing.highestQualification,
      data.highestQualification,
    ),

    resumeUrl: extra.resumeUrl || existing.resumeUrl,
    resumeText: extra.resumeText || existing.resumeText,
    resumeHash: existing.resumeHash || extra.resumeHash,
  };
}

////////////////////////////////////////////////////////////
/// MAIN FUNCTION
////////////////////////////////////////////////////////////

async function createOrFindCandidate(data, source, extra = {}) {
  const email = isValidEmail(data.email)
    ? data.email.toLowerCase().trim()
    : null;

  const phone = normalizePhone(data.phone);

  if (!email && !phone) return null;

  ////////////////////////////////////////////////////////////
  /// CHECK EXISTING
  ////////////////////////////////////////////////////////////

  const existing = await prisma.candidate.findFirst({
    where: {
      OR: [
        ...(extra.resumeHash ? [{ resumeHash: extra.resumeHash }] : []),
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  ////////////////////////////////////////////////////////////
  /// UPDATE EXISTING
  ////////////////////////////////////////////////////////////

  if (existing) {
    const updated = await prisma.candidate.update({
      where: { id: existing.id },
      data: buildUpdateData(existing, data, extra),
    });

    return {
      candidate: updated,
      isNew: false,
    };
  }

  ////////////////////////////////////////////////////////////
  /// CREATE NEW
  ////////////////////////////////////////////////////////////

  const normalizedSkills = normalizeSkills(data.skills);

  ////////////////////////////////////////////////////////////
  /// 🔥 EMBEDDING (ONLY HERE)
  ////////////////////////////////////////////////////////////

  const candidateText = buildCandidateEmbeddingText({
    skillsArray: normalizedSkills
      ? normalizedSkills.split(",").map((s) => s.trim())
      : [],
    totalExperience: resolveTotalExperience(data),
    currentRole: data.currentDesignation,
  });

  let embedding = null;

  try {
    embedding = await getEmbedding(candidateText);
  } catch (err) {
    console.error("Embedding failed:", err.message);
  }

  ////////////////////////////////////////////////////////////

  const created = await prisma.candidate.create({
    data: {
      name: data.name || "Unknown",
      email,
      phone,

      currentLocation: data.currentLocation || null,
      preferredLocations: data.preferredLocations || null,
      hometown: data.hometown || null,
      pincode: data.pincode || null,

      totalExperience: resolveTotalExperience(data),

      currentCompany: data.currentCompany || null,
      currentDesignation: data.currentDesignation || null,
      department: data.department || null,
      industry: data.industry || null,

      skills: normalizedSkills,
      skillsArray: normalizedSkills
        ? normalizedSkills.split(",").map((s) => s.trim().toLowerCase())
        : [],

      currentSalary: parseSalary(data.currentSalary),
      expectedSalary: parseSalary(data.expectedSalary),
      noticePeriodDays: parseNoticePeriod(data.noticePeriodDays),

      highestQualification: data.highestQualification || null,

      resumeUrl: extra.resumeUrl || data.resumeUrl || null,
      resumeText: extra.resumeText || null,
      resumeHash: extra.resumeHash || null,

      ////////////////////////////////////////////////////////////
      /// 🔥 SAVE EMBEDDING
      ////////////////////////////////////////////////////////////

      embedding,

      ////////////////////////////////////////////////////////////

      source,
    },
  });

  return {
    candidate: created,
    isNew: true,
  };
}

module.exports = {
  createOrFindCandidate,
};
