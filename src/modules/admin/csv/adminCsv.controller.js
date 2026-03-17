const csvService = require("./adminCsv.service");

async function uploadCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded",
      });
    }

    // ✅ UPDATED: destructure response
    const { summary, results } = await csvService.processCSV(req.file.path);

    return res.status(200).json({
      success: true,
      message: "CSV processed",

      // ✅ spread summary (total, created, duplicate, etc.)
      ...summary,

      // ✅ detailed row logs
      results,
    });
  } catch (error) {
    console.error("CSV upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message, // ✅ helpful for debugging
    });
  }
}

module.exports = {
  uploadCSV,
};
