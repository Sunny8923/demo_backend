////////////////////////////////////////////////////////////
/// REMOVE EDUCATION / INVALID ENTRIES
////////////////////////////////////////////////////////////

function cleanExperience(experiences = []) {
  const educationKeywords = [
    "university",
    "college",
    "bachelor",
    "master",
    "diploma",
    "school",
    "education",
    "intern", // 🔥 added improvement
    "training",
  ];

  return (experiences || []).filter((exp) => {
    const role = (exp.role || "").toLowerCase();
    const company = (exp.company || "").toLowerCase();

    const isEducation = educationKeywords.some(
      (word) => role.includes(word) || company.includes(word),
    );

    return !isEducation && exp.startDate && exp.endDate;
  });
}

////////////////////////////////////////////////////////////
/// DATE PARSER (ROBUST)
////////////////////////////////////////////////////////////

function parseDate(dateStr) {
  if (!dateStr) return null;

  dateStr = dateStr.toLowerCase().trim();

  if (dateStr === "present" || dateStr === "current") {
    return new Date();
  }

  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  // mar 2025 / mar-2025 / march 2025
  const match = dateStr.match(/([a-z]{3,})[\s-]?(\d{4})/);
  if (match) {
    const month = months[match[1].slice(0, 3)];
    const year = parseInt(match[2]);

    if (!isNaN(month) && !isNaN(year)) {
      return new Date(year, month);
    }
  }

  // 2025-03
  if (dateStr.includes("-")) {
    const [year, month] = dateStr.split("-");
    if (!isNaN(year) && !isNaN(month)) {
      return new Date(parseInt(year), parseInt(month) - 1);
    }
  }

  const d = new Date(dateStr);
  return isNaN(d) ? null : d;
}

////////////////////////////////////////////////////////////
/// TOTAL EXPERIENCE CALCULATOR
////////////////////////////////////////////////////////////

function calculateTotalExperience(experiences = []) {
  if (!Array.isArray(experiences)) return null;

  const now = new Date();

  const ranges = experiences
    .map((exp) => {
      let start = parseDate(exp.startDate);
      let end = parseDate(exp.endDate);

      if (!start || !end) return null;

      if (start > now) return null;
      if (end > now) end = now;

      if (end <= start) return null;

      return { start, end };
    })
    .filter(Boolean);

  if (!ranges.length) return null;

  ////////////////////////////////////////////////////////////
  /// SORT
  ////////////////////////////////////////////////////////////

  ranges.sort((a, b) => a.start - b.start);

  ////////////////////////////////////////////////////////////
  /// MERGE OVERLAPS
  ////////////////////////////////////////////////////////////

  const merged = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const current = ranges[i];

    if (current.start <= last.end) {
      last.end = new Date(Math.max(last.end, current.end));
    } else {
      merged.push(current);
    }
  }

  ////////////////////////////////////////////////////////////
  /// CALCULATE MONTHS
  ////////////////////////////////////////////////////////////

  let totalMonths = 0;

  merged.forEach(({ start, end }) => {
    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());

    if (end.getDate() >= start.getDate()) {
      months += 1;
    }

    totalMonths += months;
  });

  return +(totalMonths / 12).toFixed(1);
}

module.exports = {
  cleanExperience,
  calculateTotalExperience,
};
