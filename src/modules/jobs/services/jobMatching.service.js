const prisma = require("../../../config/prisma");
const { normalizeSkillsArray } = require("../../../utils/skillMap");
const { cosineSimilarity } = require("../../../utils/embedding");
const { explainMatch } = require("../../../utils/explainMatch");
const openai = require("../../../config/openai");

////////////////////////////////////////////////////////////
/// RULE-BASED SCORE (IMPROVED)
////////////////////////////////////////////////////////////

function calculateScore(candidate, job) {
  let score = 0;

  const jobSkills = normalizeSkillsArray(job.skillsArray || []);
  const candidateSkills = normalizeSkillsArray(candidate.skillsArray || []);

  ////////////////////////////////////////////////////////////
  // SKILL MATCH (STRICT)
  ////////////////////////////////////////////////////////////

  const matched = jobSkills.filter((jobSkill) =>
    candidateSkills.includes(jobSkill),
  );

  const skillScore =
    jobSkills.length > 0 ? matched.length / jobSkills.length : 0;

  score += skillScore * 70;

  ////////////////////////////////////////////////////////////
  // EXPERIENCE (SMOOTH + CAPPED)
  ////////////////////////////////////////////////////////////

  if (job.minExperience && candidate.totalExperience) {
    const ratio = candidate.totalExperience / job.minExperience;

    score += Math.min(ratio, 1.5) * 20;
  }

  return score;
}

////////////////////////////////////////////////////////////
/// RECRUITER TAG LOGIC
////////////////////////////////////////////////////////////

function getMatchTag({ score, missingSkills }) {
  if (score >= 85 && missingSkills.length === 0) {
    return "🔥 Top Candidate";
  }

  if (score >= 70) {
    return "✅ Good Match";
  }

  if (missingSkills.length > 0 && missingSkills.length <= 2) {
    return "⚠️ Missing Few Skills";
  }

  return "❌ Weak Match";
}

////////////////////////////////////////////////////////////
/// AI RE-RANKING
////////////////////////////////////////////////////////////

async function rerankCandidatesWithAI(job, candidates) {
  try {
    const prompt = `
You are an ATS system.

Job:
Title: ${job.title}
Skills: ${(job.skillsArray || []).join(", ")}
Experience: ${job.minExperience} years

Candidates:
${candidates
  .map(
    (c, i) => `
${i + 1}. ${c.name}
Skills: ${c.skills.join(", ")}
Score: ${c.score}
`,
  )
  .join("\n")}

Return ONLY top 3 candidate numbers in order (e.g., 2,1,3)
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const text = response.choices[0].message.content;

    const indexes = text
      .match(/\d+/g)
      ?.map((n) => parseInt(n) - 1)
      .filter((i) => i >= 0 && i < candidates.length);

    if (!indexes || indexes.length === 0) return candidates;

    const reranked = indexes.map((i) => candidates[i]);

    return [...reranked, ...candidates.filter((_, i) => !indexes.includes(i))];
  } catch (err) {
    console.error("AI rerank failed:", err.message);
    return candidates;
  }
}

////////////////////////////////////////////////////////////
/// MAIN MATCHER
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
  // NORMALIZE JOB SKILLS
  ////////////////////////////////////////////////////////////

  const normalizedJobSkills = normalizeSkillsArray(job.skillsArray || []);

  ////////////////////////////////////////////////////////////
  // GET CANDIDATES (PRE-FILTERED)
  ////////////////////////////////////////////////////////////

  const candidates = await prisma.candidate.findMany({
    where: {
      skillsArray: {
        hasSome: job.skillsArray || [],
      },
      embedding: {
        not: null,
      },
    },
    take: 200,
  });

  ////////////////////////////////////////////////////////////
  // SCORING
  ////////////////////////////////////////////////////////////

  const results = [];

  for (const candidate of candidates) {
    const normalizedCandidateSkills = normalizeSkillsArray(
      candidate.skillsArray || [],
    );

    ////////////////////////////////////////////////////////////
    // RULE SCORE
    ////////////////////////////////////////////////////////////

    const baseScore = calculateScore(candidate, job);

    ////////////////////////////////////////////////////////////
    // SEMANTIC SCORE
    ////////////////////////////////////////////////////////////

    let semanticScore = 0;

    try {
      semanticScore = cosineSimilarity(job.embedding, candidate.embedding);
    } catch (err) {
      console.error("Similarity error:", err.message);
    }

    ////////////////////////////////////////////////////////////
    // FINAL SCORE
    ////////////////////////////////////////////////////////////

    const finalScore = baseScore * 0.6 + semanticScore * 40;

    ////////////////////////////////////////////////////////////
    // MATCHED + MISSING SKILLS
    ////////////////////////////////////////////////////////////

    const matchedSkills = normalizedJobSkills.filter((s) =>
      normalizedCandidateSkills.includes(s),
    );

    const missingSkills = normalizedJobSkills.filter(
      (s) => !normalizedCandidateSkills.includes(s),
    );

    ////////////////////////////////////////////////////////////
    // EXPLANATION
    ////////////////////////////////////////////////////////////

    const reasons = explainMatch({
      jobSkills: normalizedJobSkills,
      candidateSkills: normalizedCandidateSkills,
      matchedSkills,
      jobMinExp: job.minExperience,
      candidateExp: candidate.totalExperience,
      semanticScore,
    });

    ////////////////////////////////////////////////////////////
    // TAG
    ////////////////////////////////////////////////////////////

    const tag = getMatchTag({
      score: Math.round(finalScore),
      missingSkills,
    });

    ////////////////////////////////////////////////////////////
    // PUSH
    ////////////////////////////////////////////////////////////

    results.push({
      candidateId: candidate.id,
      name: candidate.name,

      score: Math.round(finalScore),

      baseScore: Math.round(baseScore),
      semanticScore: Math.round(semanticScore * 100),

      matchedSkills,
      missingSkills,
      skills: candidate.skillsArray,

      reasons,
      tag,
    });
  }

  ////////////////////////////////////////////////////////////
  // SORT
  ////////////////////////////////////////////////////////////

  results.sort((a, b) => b.score - a.score);

  ////////////////////////////////////////////////////////////
  // AI RE-RANK TOP 10
  ////////////////////////////////////////////////////////////

  const topCandidates = results.slice(0, 10);

  const reranked = await rerankCandidatesWithAI(job, topCandidates);

  ////////////////////////////////////////////////////////////
  // MARK TOP PICKS
  ////////////////////////////////////////////////////////////

  const finalResults = reranked.map((c, i) => ({
    ...c,
    isTopPick: i < 3,
  }));

  return finalResults;
}

module.exports = {
  matchCandidatesToJob,
};
