const csvService = require("./adminCsv.service");

const { uploadToR2 } = require("../../../utils/uploadToR2");

const os = require("os");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
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

    const { summary, results } = await csvService.processCSVBuffer(
      req.file.buffer,
      req.file.originalname,
    );

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
