////////////////////////////////////////////////////////////
/// EXPLAIN MATCH (HUMAN READABLE REASONS)
////////////////////////////////////////////////////////////

function explainMatch({
  jobSkills = [],
  candidateSkills = [],
  matchedSkills = [],
  jobMinExp = 0,
  candidateExp = 0,
  semanticScore = 0,
}) {
  const reasons = [];

  ////////////////////////////////////////////////////////////
  // SKILL MATCH REASON
  ////////////////////////////////////////////////////////////

  if (jobSkills.length > 0) {
    reasons.push(
      `Matched ${matchedSkills.length}/${jobSkills.length} required skills`,
    );
  }

  ////////////////////////////////////////////////////////////
  // EXPERIENCE REASON
  ////////////////////////////////////////////////////////////

  if (jobMinExp && candidateExp) {
    if (candidateExp >= jobMinExp) {
      reasons.push(
        `Experience meets requirement (${candidateExp} yrs vs ${jobMinExp} yrs required)`,
      );
    } else {
      reasons.push(
        `Slightly below experience requirement (${candidateExp}/${jobMinExp} yrs)`,
      );
    }
  }

  ////////////////////////////////////////////////////////////
  // SEMANTIC REASON
  ////////////////////////////////////////////////////////////

  const semanticPercent = Math.round(semanticScore * 100);

  if (semanticPercent > 80) {
    reasons.push("Strong overall profile relevance");
  } else if (semanticPercent > 60) {
    reasons.push("Good match based on profile context");
  } else if (semanticPercent > 40) {
    reasons.push("Moderate relevance to job");
  } else {
    reasons.push("Low contextual match");
  }

  ////////////////////////////////////////////////////////////
  // BONUS: TOP SKILL HIGHLIGHT
  ////////////////////////////////////////////////////////////

  if (matchedSkills.length > 0) {
    reasons.push(`Key strengths: ${matchedSkills.slice(0, 3).join(", ")}`);
  }

  return reasons;
}

module.exports = { explainMatch };
