const csvService = require("./adminCsv.service");

const { uploadToR2 } = require("../../../utils/uploadToR2");

const os = require("os");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

////////////////////////////////////////////////////////////
/// DOWNLOAD R2 → TEMP FILE
////////////////////////////////////////////////////////////

async function downloadToTempFile(url, fileName) {
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);

  const res = await axios.get(url, {
    responseType: "stream",
  });

  const writer = fs.createWriteStream(tempPath);

  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return tempPath;
}

////////////////////////////////////////////////////////////
/// MAIN CONTROLLER
////////////////////////////////////////////////////////////

async function uploadCSV(req, res) {
  try {
    ////////////////////////////////////////////////////////////
    /// VALIDATION
    ////////////////////////////////////////////////////////////

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded",
      });
    }

    ////////////////////////////////////////////////////////////
    /// UPLOAD TO R2
    ////////////////////////////////////////////////////////////

    const r2Url = await uploadToR2(req.file);

    if (!r2Url) {
      return res.status(500).json({
        success: false,
        message: "CSV upload failed",
      });
    }

    ////////////////////////////////////////////////////////////
    /// DOWNLOAD TO TEMP
    ////////////////////////////////////////////////////////////

    const tempPath = await downloadToTempFile(r2Url, req.file.originalname);

    ////////////////////////////////////////////////////////////
    /// PROCESS CSV (UNCHANGED LOGIC)
    ////////////////////////////////////////////////////////////

    const { summary, results } = await csvService.processCSV(tempPath);

    return res.status(200).json({
      success: true,
      message: "CSV processed",
      ...summary,
      results,
    });
  } catch (error) {
    console.error("CSV upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

module.exports = {
  uploadCSV,
};
