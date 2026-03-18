const prisma = require("../../../config/prisma");

////////////////////////////////////////////////////////
// GET CANDIDATES WITH FILTERS
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

  // prevent abuse
  if (limit > 50) limit = 50;

  const skip = (page - 1) * limit;

  const AND = [];

  ////////////////////////////////////////////////////////
  /// SEARCH
  ////////////////////////////////////////////////////////

  if (search && search.trim() !== "") {
    search = search.trim();

    AND.push({
      OR: [
        {
          name: { contains: search, mode: "insensitive" },
        },
        {
          email: { contains: search, mode: "insensitive" },
        },
        {
          skills: { contains: search, mode: "insensitive" },
        },
        {
          currentCompany: { contains: search, mode: "insensitive" },
        },
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
  /// SKILLS (MULTI)
  ////////////////////////////////////////////////////////

  if (skills && skills.trim() !== "") {
    const skillsArray = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const skill of skillsArray) {
      AND.push({
        skills: {
          contains: skill,
          mode: "insensitive",
        },
      });
    }
  }

  ////////////////////////////////////////////////////////
  /// FINAL WHERE
  ////////////////////////////////////////////////////////

  const where = AND.length > 0 ? { AND } : {};

  ////////////////////////////////////////////////////////
  /// QUERY
  ////////////////////////////////////////////////////////

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },

      // ✅ IMPORTANT: lightweight response
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
        createdAt: true,
      },
    }),

    prisma.candidate.count({ where }),
  ]);

  ////////////////////////////////////////////////////////
  /// RESPONSE
  ////////////////////////////////////////////////////////

  return {
    candidates,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = {
  getCandidates,
};
