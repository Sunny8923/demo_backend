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

////////////////////////////////////////////////////////
// GET SINGLE CANDIDATE
////////////////////////////////////////////////////////

async function getCandidateById(req, res) {
  try {
    const { id } = req.params;

    const candidate = await candidateService.getCandidateById(id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    return res.status(200).json({
      success: true,
      candidate,
    });
  } catch (error) {
    console.error("Get candidate error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch candidate",
    });
  }
}

module.exports = {
  getCandidates,
  getCandidateById,
};
