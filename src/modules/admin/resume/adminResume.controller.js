const prisma = require("../../../config/prisma");
const resumeService = require("./adminResume.service");
const path = require("path");
const resumeQueue = require("../../../queues/resume.queue");

async function uploadResumes(req, res) {
  try {
    ////////////////////////////////////////////////////////////
    /// VALIDATION
    ////////////////////////////////////////////////////////////

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No resume files uploaded",
      });
    }

    ////////////////////////////////////////////////////////////
    /// CALCULATE REAL TOTAL (INCLUDING ZIP)
    ////////////////////////////////////////////////////////////

    let total = 0;

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === ".zip") {
        const count = await resumeService.countZipFiles(file.path);
        total += count;
      } else {
        total += 1;
      }
    }

    ////////////////////////////////////////////////////////////
    /// EDGE CASE: EMPTY ZIP OR NO VALID FILES
    ////////////////////////////////////////////////////////////

    if (total === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid resume files found",
      });
    }

    ////////////////////////////////////////////////////////////
    /// CREATE JOB
    ////////////////////////////////////////////////////////////

    const job = await prisma.uploadJob.create({
      data: {
        status: "processing",
        total,
        processed: 0,
      },
    });

    ////////////////////////////////////////////////////////////
    /// RESPOND IMMEDIATELY
    ////////////////////////////////////////////////////////////

    res.status(200).json({
      success: true,
      message: "Upload started",
      jobId: job.id,
    });

    ////////////////////////////////////////////////////////////
    /// PREPARE SAFE FILE DATA (IMPORTANT)
    ////////////////////////////////////////////////////////////

    const safeFiles = req.files.map((f) => ({
      originalname: f.originalname,
      path: f.path,
    }));

    ////////////////////////////////////////////////////////////
    /// ADD TO QUEUE (NON-BLOCKING + RETRY)
    ////////////////////////////////////////////////////////////

    resumeQueue
      .add(
        "resume-upload",
        {
          files: safeFiles,
          jobId: job.id,
          total,
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
        console.error("Queue add failed:", err);

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
    console.error("Upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  uploadResumes,
};
