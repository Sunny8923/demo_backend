const openai = require("../config/openai");

////////////////////////////////////////////////////////////
/// STRUCTURED TEXT BUILDERS (VERY IMPORTANT)
////////////////////////////////////////////////////////////

function buildCandidateEmbeddingText(candidate) {
  return `
Skills: ${(candidate.skillsArray || []).join(", ")}
Experience: ${candidate.totalExperience || 0} years
Current Role: ${candidate.currentRole || ""}
`.trim();
}

function buildJobEmbeddingText(job) {
  return `
Required Skills: ${(job.skillsArray || []).join(", ")}
Minimum Experience: ${job.minExperience || 0} years
Job Title: ${job.title || ""}
`.trim();
}

////////////////////////////////////////////////////////////
/// GET EMBEDDING
////////////////////////////////////////////////////////////

async function getEmbedding(text) {
  try {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return res.data[0].embedding;
  } catch (err) {
    console.error("Embedding error:", err.message);
    return null;
  }
}

////////////////////////////////////////////////////////////
/// COSINE SIMILARITY (SAFE)
////////////////////////////////////////////////////////////

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

module.exports = {
  getEmbedding,
  cosineSimilarity,
  buildCandidateEmbeddingText,
  buildJobEmbeddingText,
};
