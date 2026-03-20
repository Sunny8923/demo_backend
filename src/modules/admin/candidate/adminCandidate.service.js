const prisma = require("../../../config/prisma");
const { getEmbedding, cosineSimilarity } = require("../../../utils/embedding");

////////////////////////////////////////////////////////
// GET CANDIDATES
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
  /// SANITIZE
  ////////////////////////////////////////////////////////

  page = Number(page) || 1;
  limit = Number(limit) || 20;

  if (limit > 50) limit = 50;

  const skip = (page - 1) * limit;

  const AND = [];

  ////////////////////////////////////////////////////////
  /// SEARCH FILTER
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

  const where = AND.length > 0 ? { AND } : {};

  ////////////////////////////////////////////////////////
  /// FETCH
  ////////////////////////////////////////////////////////

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc", // ✅ default sorting
      },
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
        createdAt: true,
        embedding: true, // internal use only
      },
    }),

    prisma.candidate.count({ where }),
  ]);

  ////////////////////////////////////////////////////////
  /// NO SEARCH MODE (🔥 CLEAN)
  ////////////////////////////////////////////////////////

  const isSearchMode = (search && search.length > 0) || searchSkills.length > 0;

  if (!isSearchMode) {
    return {
      candidates: candidates.map((c) => {
        const { embedding, ...rest } = c;
        return rest; // ✅ no score fields
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  ////////////////////////////////////////////////////////
  /// SEMANTIC PREP
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
  /// SCORING
  ////////////////////////////////////////////////////////

  const scored = candidates.map((c) => {
    let score = 0;

    let matchedSkills = [];

    if (search && c.name?.toLowerCase().includes(search.toLowerCase())) {
      score += 20;
    }

    if (searchSkills.length > 0) {
      matchedSkills = searchSkills.filter((s) => c.skillsArray?.includes(s));

      score += matchedSkills.length * 10;
    }

    if (c.totalExperience) {
      score += Math.min(c.totalExperience, 10);
    }

    let semanticScore = 0;

    if (searchEmbedding && c.embedding) {
      try {
        semanticScore = cosineSimilarity(searchEmbedding, c.embedding);
        score += semanticScore * 30;
      } catch (err) {}
    }

    let matchPercentage = 0;

    if (searchSkills.length > 0) {
      matchPercentage = (matchedSkills.length / searchSkills.length) * 100;
    } else if (semanticScore) {
      matchPercentage = semanticScore * 100;
    }

    const { embedding, ...rest } = c;

    return {
      ...rest,
      score: Math.round(score),
      semanticScore: Math.round(semanticScore * 100),
      matchPercentage: Math.round(matchPercentage),
      matchedSkills,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    candidates: scored,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

////////////////////////////////////////////////////////
// GET SINGLE CANDIDATE
////////////////////////////////////////////////////////

async function getCandidateById(id) {
  return prisma.candidate.findUnique({
    where: { id },
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
      createdAt: true,
    },
  });
}

module.exports = {
  getCandidates,
  getCandidateById,
};
