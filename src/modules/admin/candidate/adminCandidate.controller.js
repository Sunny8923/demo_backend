const candidateService = require("./adminCandidate.service");

////////////////////////////////////////////////////////
// GET CANDIDATES
////////////////////////////////////////////////////////

async function getCandidates(req, res) {
  try {
    const {
      search,
      minExperience,
      maxExperience,
      location,
      skills,
      page = 1,
      limit = 20,
    } = req.query;

    const data = await candidateService.getCandidates({
      search,
      minExperience,
      maxExperience,
      location,
      skills,
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Get candidates error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch candidates",
    });
  }
}

module.exports = {
  getCandidates,
};
