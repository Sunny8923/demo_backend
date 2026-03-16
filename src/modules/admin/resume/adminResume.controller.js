const resumeService = require("./adminResume.service");

async function uploadResumes(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No resume files uploaded",
      });
    }

    const parsedResumes = await resumeService.processResumes(req.files);

    return res.status(200).json({
      success: true,
      message: "Resumes processed successfully",
      count: parsedResumes.length,
      resumes: parsedResumes,
    });
  } catch (error) {
    console.error("Resume upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

module.exports = {
  uploadResumes,
};
