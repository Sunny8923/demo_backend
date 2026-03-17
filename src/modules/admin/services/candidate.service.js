const prisma = require("../../../config/prisma");

////////////////////////////////////////////////////////////
/// HELPERS (ADD THESE)
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

////////////////////////////////////////////////////////////
/// MAIN FUNCTION
////////////////////////////////////////////////////////////

async function createOrFindCandidate(data, source, extra = {}) {
  const email = isValidEmail(data.email) ? data.email : null;
  const phone = normalizePhone(data.phone);

  if (!email && !phone) return null;

  ////////////////////////////////////////////////////////////
  /// CHECK EXISTING
  ////////////////////////////////////////////////////////////

  const existing = await prisma.candidate.findFirst({
    where: {
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    },
  });

  if (existing) {
    return {
      candidate: existing,
      isNew: false,
    };
  }

  ////////////////////////////////////////////////////////////
  /// CREATE NEW
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

      totalExperience: parseExperience(data.totalExperience),

      currentCompany: data.currentCompany || null,
      currentDesignation: data.currentDesignation || null,
      department: data.department || null,
      industry: data.industry || null,

      skills: normalizeSkills(data.skills),

      currentSalary: parseSalary(data.currentSalary),
      expectedSalary: parseSalary(data.expectedSalary),
      noticePeriodDays: parseNoticePeriod(data.noticePeriodDays),

      highestQualification: data.highestQualification || null,

      resumeUrl: extra.resumeUrl || data.resumeUrl || null,
      resumeText: extra.resumeText || null,
      resumeHash: extra.resumeHash || null,

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
