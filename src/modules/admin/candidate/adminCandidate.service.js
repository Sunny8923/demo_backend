const prisma = require("../../../config/prisma");
const { getEmbedding, cosineSimilarity } = require("../../../utils/embedding");

////////////////////////////////////////////////////////
// GET CANDIDATES WITH SMART + SEMANTIC SEARCH
////////////////////////////////////////////////////////

async function getCandidates(filters) {
  let {
    search,
    minExperience,
    maxExperience,
    location,
    skills,
    page = 1,
    limit = 20,
  } = filters;

  ////////////////////////////////////////////////////////
  /// SANITIZE INPUT
  ////////////////////////////////////////////////////////

  page = Number(page) || 1;
  limit = Number(limit) || 20;

  if (limit > 50) limit = 50;

  const skip = (page - 1) * limit;

  const AND = [];

  ////////////////////////////////////////////////////////
  /// SEARCH FILTER (DB LEVEL)
  ////////////////////////////////////////////////////////

  if (search && search.trim() !== "") {
    search = search.trim();

    AND.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { skills: { contains: search, mode: "insensitive" } },
        { currentCompany: { contains: search, mode: "insensitive" } },
        {
          currentDesignation: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  ////////////////////////////////////////////////////////
  /// LOCATION
  ////////////////////////////////////////////////////////

  if (location && location.trim() !== "") {
    AND.push({
      currentLocation: {
        contains: location.trim(),
        mode: "insensitive",
      },
    });
  }

  ////////////////////////////////////////////////////////
  /// EXPERIENCE
  ////////////////////////////////////////////////////////

  if (minExperience || maxExperience) {
    AND.push({
      totalExperience: {
        gte: minExperience ? Number(minExperience) : 0,
        lte: maxExperience ? Number(maxExperience) : 100,
      },
    });
  }

  ////////////////////////////////////////////////////////
  /// SKILLS FILTER
  ////////////////////////////////////////////////////////

  let searchSkills = [];

  if (skills && skills.trim() !== "") {
    searchSkills = skills
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    AND.push({
      skillsArray: {
        hasSome: searchSkills,
      },
    });
  }

  ////////////////////////////////////////////////////////
  /// FINAL WHERE
  ////////////////////////////////////////////////////////

  const where = AND.length > 0 ? { AND } : {};

  ////////////////////////////////////////////////////////
  /// FETCH DATA
  ////////////////////////////////////////////////////////

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,

      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        currentLocation: true,
        totalExperience: true,
        currentCompany: true,
        currentDesignation: true,
        skills: true,
        skillsArray: true,
        embedding: true, // 🔥 needed for semantic
        createdAt: true,
      },
    }),

    prisma.candidate.count({ where }),
  ]);

  ////////////////////////////////////////////////////////
  /// SEMANTIC SEARCH PREP
  ////////////////////////////////////////////////////////

  let searchEmbedding = null;

  if (search && search.length > 2) {
    try {
      searchEmbedding = await getEmbedding(search);
    } catch (err) {
      console.error("Search embedding failed:", err.message);
    }
  }

  ////////////////////////////////////////////////////////
  /// SCORING ENGINE 🔥
  ////////////////////////////////////////////////////////

  const scored = candidates.map((c) => {
    let score = 0;

    ////////////////////////////////////////////////////////
    /// NAME MATCH
    ////////////////////////////////////////////////////////

    if (search && c.name?.toLowerCase().includes(search.toLowerCase())) {
      score += 20;
    }

    ////////////////////////////////////////////////////////
    /// SKILL MATCH
    ////////////////////////////////////////////////////////

    let matchedSkills = [];

    if (searchSkills.length > 0) {
      matchedSkills = searchSkills.filter((s) => c.skillsArray?.includes(s));

      score += matchedSkills.length * 10;
    }

    ////////////////////////////////////////////////////////
    /// EXPERIENCE BOOST
    ////////////////////////////////////////////////////////

    if (c.totalExperience) {
      score += Math.min(c.totalExperience, 10);
    }

    ////////////////////////////////////////////////////////
    /// SEMANTIC MATCH 🔥
    ////////////////////////////////////////////////////////

    let semanticScore = 0;

    if (searchEmbedding && c.embedding) {
      try {
        semanticScore = cosineSimilarity(searchEmbedding, c.embedding);

        score += semanticScore * 30;
      } catch (err) {
        console.error("Semantic error:", err.message);
      }
    }

    ////////////////////////////////////////////////////////
    /// MATCH %
    ////////////////////////////////////////////////////////

    let matchPercentage = 0;

    if (searchSkills.length > 0) {
      matchPercentage = (matchedSkills.length / searchSkills.length) * 100;
    } else if (semanticScore) {
      matchPercentage = semanticScore * 100;
    }

    ////////////////////////////////////////////////////////
    /// RETURN
    ////////////////////////////////////////////////////////

    return {
      ...c,
      score: Math.round(score),
      semanticScore: Math.round(semanticScore * 100),
      matchPercentage: Math.round(matchPercentage),
      matchedSkills,
    };
  });

  ////////////////////////////////////////////////////////
  /// SORT
  ////////////////////////////////////////////////////////

  scored.sort((a, b) => b.score - a.score);

  ////////////////////////////////////////////////////////
  /// RESPONSE
  ////////////////////////////////////////////////////////

  return {
    candidates: scored,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = {
  getCandidates,
};
