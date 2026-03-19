const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const prisma = require("../config/prisma");

const resumeService = require("../modules/admin/resume/adminResume.service");

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const worker = new Worker(
  "resumeQueue",
  async (job) => {
    const { files, jobId, total } = job.data;

    console.log("Processing job:", jobId);

    await resumeService.processResumes(files, jobId, job, total);
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
    await prisma.uploadJob.update({
      where: { id: job.data.jobId },
      data: {
        status: "failed",
      },
    });
  } catch (e) {
    console.error("Failed to update job status:", e);
  }
});

worker.on("stalled", (jobId) => {
  console.warn(`Job stalled: ${jobId}`);
});
