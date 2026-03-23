const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const prisma = require("../config/prisma");

const resumeService = require("../modules/admin/resume/adminResume.service");
const csvService = require("../modules/admin/csv/adminCsv.service");

const axios = require("axios");

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const worker = new Worker(
  "resumeQueue",
  async (job) => {
    console.log("Processing job:", job.name, job.data?.jobId);

    ////////////////////////////////////////////////////////////
    /// ✅ RESUME JOB (UNCHANGED)
    ////////////////////////////////////////////////////////////
    if (job.name === "resumeUpload") {
      const { files, jobId, total } = job.data;

      return await resumeService.processResumes(files, jobId, job, total);
    }

    ////////////////////////////////////////////////////////////
    /// ✅ CSV JOB (NEW)
    ////////////////////////////////////////////////////////////
    if (job.name === "csvUpload") {
      const { jobId, fileUrl, fileName } = job.data;

      console.log("Processing CSV job:", jobId);

      ////////////////////////////////////////////////////////////
      /// 1. DOWNLOAD FILE FROM R2
      ////////////////////////////////////////////////////////////
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);

      ////////////////////////////////////////////////////////////
      /// 2. PROCESS CSV
      ////////////////////////////////////////////////////////////
      const { summary } = await csvService.processCSVBuffer(buffer, fileName);

      ////////////////////////////////////////////////////////////
      /// 3. UPDATE JOB STATUS
      ////////////////////////////////////////////////////////////
      await prisma.uploadJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          meta: summary,
        },
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    /// UNKNOWN JOB SAFETY
    ////////////////////////////////////////////////////////////
    console.warn("Unknown job type:", job.name);
  },
  {
    connection,
    concurrency: 3,
  },
);

////////////////////////////////////////////////////////////
/// EVENTS
////////////////////////////////////////////////////////////

worker.on("completed", async (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);

  try {
    if (job?.data?.jobId) {
      await prisma.uploadJob.update({
        where: { id: job.data.jobId },
        data: {
          status: "failed",
          error: err.message, // ✅ added for better debugging
        },
      });
    }
  } catch (e) {
    console.error("Failed to update job status:", e);
  }
});

worker.on("stalled", (jobId) => {
  console.warn(`Job stalled: ${jobId}`);
});
