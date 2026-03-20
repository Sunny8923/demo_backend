const prisma = require("../../../config/prisma");
const resumeService = require("./adminResume.service");
const path = require("path");
const os = require("os");
const fs = require("fs");
const axios = require("axios");

const resumeQueue = require("../../../queues/resume.queue");
const { uploadToR2 } = require("../../../utils/uploadToR2");

////////////////////////////////////////////////////////////
/// HELPER: DOWNLOAD R2 FILE TO TEMP
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
    /// UPLOAD FILES TO R2 FIRST
    ////////////////////////////////////////////////////////////

    const uploadedFiles = [];

    for (const file of req.files) {
      try {
        const r2Url = await uploadToR2(file);

        ////////////////////////////////////////////////////////////
        /// ✅ ONLY PUSH IF UPLOAD SUCCESSFUL
        ////////////////////////////////////////////////////////////

        if (!r2Url) {
          console.error("Upload failed, skipping:", file.originalname);
          continue;
        }

        uploadedFiles.push({
          originalname: file.originalname,
          url: r2Url,
        });
      } catch (err) {
        console.error("R2 upload failed:", file.originalname, err.message);
      }
    }

    ////////////////////////////////////////////////////////////
    /// SAFETY CHECK
    ////////////////////////////////////////////////////////////

    if (uploadedFiles.length === 0) {
      return res.status(500).json({
        success: false,
        message: "All uploads failed",
      });
    }

    ////////////////////////////////////////////////////////////
    /// CALCULATE TOTAL (INCLUDING ZIP)
    ////////////////////////////////////////////////////////////

    let total = 0;

    for (const file of uploadedFiles) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === ".zip") {
        try {
          const tempZipPath = await downloadToTempFile(
            file.url,
            file.originalname,
          );

          const count = await resumeService.countZipFiles(tempZipPath);

          await fs.promises.unlink(tempZipPath);

          total += count;
        } catch (err) {
          console.error("ZIP count failed:", err.message);
        }
      } else {
        total += 1;
      }
    }

    ////////////////////////////////////////////////////////////
    /// EDGE CASE
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
    /// ADD TO QUEUE
    ////////////////////////////////////////////////////////////

    resumeQueue
      .add(
        "resume-upload",
        {
          files: uploadedFiles,
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
