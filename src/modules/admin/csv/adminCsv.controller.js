const prisma = require("../../../config/prisma");

const resumeQueue = require("../../../queues/resume.queue");
const { uploadToR2 } = require("../../../utils/uploadToR2");

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
    /// CREATE JOB (MATCHES YOUR SCHEMA ✅)
    ////////////////////////////////////////////////////////////

    const job = await prisma.uploadJob.create({
      data: {
        status: "processing",
        total: 0,
        processed: 0,
        created: 0,
        duplicate: 0,
        skipped: 0,
        error: 0,
      },
    });

    ////////////////////////////////////////////////////////////
    /// RESPOND IMMEDIATELY 🚀
    ////////////////////////////////////////////////////////////

    res.status(200).json({
      success: true,
      message: "CSV upload started",
      jobId: job.id,
    });

    ////////////////////////////////////////////////////////////
    /// ADD TO QUEUE
    ////////////////////////////////////////////////////////////

    resumeQueue
      .add(
        "csvUpload",
        {
          jobId: job.id,
          fileUrl: r2Url,
          fileName: req.file.originalname,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      )
      .catch(async (err) => {
        console.error("CSV Queue add failed:", err);

        try {
          await prisma.uploadJob.update({
            where: { id: job.id },
            data: {
              status: "failed",
            },
          });
        } catch (updateErr) {
          console.error("Failed to update job status:", updateErr);
        }
      });
  } catch (error) {
    console.error("CSV upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  uploadCSV,
};
