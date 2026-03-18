const prisma = require("../../../config/prisma");
const { normalizeSkillsArray } = require("../../../utils/skillMap");
const { cosineSimilarity } = require("../../../utils/embedding");

////////////////////////////////////////////////////////////
/// RULE-BASED SCORE
////////////////////////////////////////////////////////////

function calculateScore(candidate, job) {
  let score = 0;

  const jobSkills = normalizeSkillsArray(job.skillsArray || []);
  const candidateSkills = normalizeSkillsArray(candidate.skillsArray || []);

  ////////////////////////////////////////////////////////////
  // SKILL MATCH
  ////////////////////////////////////////////////////////////

  const matched = jobSkills.filter((jobSkill) =>
    candidateSkills.some(
      (candSkill) =>
        candSkill === jobSkill ||
        candSkill.includes(jobSkill) ||
        jobSkill.includes(candSkill),
    ),
  );

  const skillScore =
    jobSkills.length > 0 ? matched.length / jobSkills.length : 0;

  score += skillScore * 70;

  ////////////////////////////////////////////////////////////
  // EXTRA SKILLS BONUS
  ////////////////////////////////////////////////////////////

  const extraSkills = candidateSkills.filter((s) => !jobSkills.includes(s));

  score += Math.min(extraSkills.length * 2, 10);

  ////////////////////////////////////////////////////////////
  // EXPERIENCE
  ////////////////////////////////////////////////////////////

  if (job.minExperience && candidate.totalExperience) {
    if (candidate.totalExperience >= job.minExperience) {
      score += 30;
    } else {
      score += (candidate.totalExperience / job.minExperience) * 30;
    }
  }

  return Math.round(score);
}

////////////////////////////////////////////////////////////
/// MAIN MATCHER (NO API CALLS)
////////////////////////////////////////////////////////////

async function matchCandidatesToJob(jobId) {
  ////////////////////////////////////////////////////////////
  // GET JOB
  ////////////////////////////////////////////////////////////

  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) throw new Error("Job not found");

  ////////////////////////////////////////////////////////////
  // SAFETY: JOB MUST HAVE EMBEDDING
  ////////////////////////////////////////////////////////////

  if (!job.embedding) {
    throw new Error("Job embedding missing (run backfill)");
  }

  ////////////////////////////////////////////////////////////
  // GET CANDIDATES
  ////////////////////////////////////////////////////////////

  const candidates = await prisma.candidate.findMany({
    where: {
      skillsArray: {
        isEmpty: false,
      },
      embedding: {
        not: null,
      },
    },
    take: 100, // ⚠️ adjust later
  });

  ////////////////////////////////////////////////////////////
  // SCORING
  ////////////////////////////////////////////////////////////

  const results = [];

  for (const candidate of candidates) {
    ////////////////////////////////////////////////////////////
    // RULE SCORE
    ////////////////////////////////////////////////////////////

    const baseScore = calculateScore(candidate, job);

    ////////////////////////////////////////////////////////////
    // SEMANTIC SCORE (FAST)
    ////////////////////////////////////////////////////////////

    let semanticScore = 0;

    try {
      semanticScore = cosineSimilarity(job.embedding, candidate.embedding);
    } catch (err) {
      console.error("Similarity error:", err.message);
    }

    ////////////////////////////////////////////////////////////
    // FINAL SCORE (HYBRID)
    ////////////////////////////////////////////////////////////

    const finalScore = baseScore * 0.6 + semanticScore * 100 * 0.4;

    results.push({
      candidateId: candidate.id,
      name: candidate.name,

      score: Math.round(finalScore),

      baseScore,
      semanticScore: Math.round(semanticScore * 100),

      skills: candidate.skillsArray,
    });
  }

  ////////////////////////////////////////////////////////////
  // SORT
  ////////////////////////////////////////////////////////////

  results.sort((a, b) => b.score - a.score);

  ////////////////////////////////////////////////////////////
  // RETURN TOP 20
  ////////////////////////////////////////////////////////////

  return results.slice(0, 20);
}

module.exports = {
  matchCandidatesToJob,
};
