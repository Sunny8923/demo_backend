const csvService = require("./adminCsv.service");

////////////////////////////////////////////////////////////
/// MAIN CONTROLLER (OPTIMIZED)
////////////////////////////////////////////////////////////

async function uploadCSV(req, res) {
  try {
    ////////////////////////////////////////////////////////////
    /// VALIDATION
    ////////////////////////////////////////////////////////////

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    ////////////////////////////////////////////////////////////
    /// FILE SIZE SAFETY
    ////////////////////////////////////////////////////////////

    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "File too large. Max 10MB allowed",
      });
    }

    ////////////////////////////////////////////////////////////
    /// PROCESS FILE
    ////////////////////////////////////////////////////////////

    const { summary, results } = await csvService.processFile(req.file);

    ////////////////////////////////////////////////////////////
    /// RESPONSE (NON-BREAKING)
    ////////////////////////////////////////////////////////////

    const MAX_PREVIEW = 100;
    const previewResults = results.slice(0, MAX_PREVIEW);

    return res.status(200).json({
      success: true,
      message: "File processed successfully",

      ...summary,

      results: previewResults, // ✅ same key, limited data

      meta: {
        totalResults: results.length,
        returnedResults: previewResults.length,
        hasMore: results.length > MAX_PREVIEW,
      },
    });
  } catch (error) {
    console.error("CSV upload error:", error);

    ////////////////////////////////////////////////////////////
    /// CLEAN ERROR HANDLING
    ////////////////////////////////////////////////////////////

    let message = "Internal server error";

    if (
      error.message?.includes("Invalid") ||
      error.message?.includes("corrupted")
    ) {
      message = "Invalid or corrupted file";
    } else if (error.message?.includes("Empty")) {
      message = "Uploaded file is empty";
    } else if (error.message?.includes("Only")) {
      message = error.message;
    }

    return res.status(500).json({
      success: false,
      message,
      error: error.message,
    });
  }
}

module.exports = {
  uploadCSV,
};
