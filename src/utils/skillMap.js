////////////////////////////////////////////////////////////
/// SKILL NORMALIZATION MAP
////////////////////////////////////////////////////////////

const SKILL_MAP = {
  // frontend
  "react.js": "react",
  reactjs: "react",
  angularjs: "angular",
  vuejs: "vue",
  nextjs: "next",
  "next.js": "next",

  // backend
  nodejs: "node",
  "node.js": "node",
  expressjs: "express",
  nestjs: "nestjs",

  // database
  mongodb: "mongo",
  "mongo db": "mongo",
  postgresql: "postgres",
  mysql: "mysql",

  // ai/ml
  ml: "machine learning",
  dl: "deep learning",
  ai: "artificial intelligence",

  // languages
  js: "javascript",
  ts: "typescript",
  cpp: "c++",

  // styling
  tailwindcss: "tailwind",
};

////////////////////////////////////////////////////////////
/// NORMALIZER
////////////////////////////////////////////////////////////

function normalizeSkill(skill) {
  if (!skill) return null;

  let cleaned = skill.toLowerCase().trim();

  // remove symbols (node.js -> nodejs)
  cleaned = cleaned.replace(/[^\w\s]/g, "");

  // normalize separators (machine-learning -> machine learning)
  cleaned = cleaned.replace(/[-_]/g, " ");

  return SKILL_MAP[cleaned] || cleaned;
}

////////////////////////////////////////////////////////////
/// NORMALIZE ARRAY (DEDUPED)
////////////////////////////////////////////////////////////

function normalizeSkillsArray(arr = []) {
  return [...new Set(arr.map(normalizeSkill).filter(Boolean))];
}

module.exports = {
  normalizeSkill,
  normalizeSkillsArray,
};
