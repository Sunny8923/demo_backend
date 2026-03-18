////////////////////////////////////////////////////////////
/// SKILL NORMALIZATION MAP
////////////////////////////////////////////////////////////

const SKILL_MAP = {
  // frontend
  "react.js": "react",
  reactjs: "react",
  angularjs: "angular",
  vuejs: "vue",

  // backend
  nodejs: "node",
  "node.js": "node",
  expressjs: "express",

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
};

////////////////////////////////////////////////////////////
/// NORMALIZER
////////////////////////////////////////////////////////////

function normalizeSkill(skill) {
  if (!skill) return null;

  const cleaned = skill.toLowerCase().trim();

  return SKILL_MAP[cleaned] || cleaned;
}

////////////////////////////////////////////////////////////
/// NORMALIZE ARRAY
////////////////////////////////////////////////////////////

function normalizeSkillsArray(arr = []) {
  return arr.map(normalizeSkill).filter(Boolean);
}

module.exports = {
  normalizeSkill,
  normalizeSkillsArray,
};
