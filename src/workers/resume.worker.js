const { Worker } = require("bullmq");
const IORedis = require("ioredis");

const resumeService = require("../modules/admin/resume/adminResume.service");

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const worker = new Worker(
  "resumeQueue",
  async (job) => {
    const { files, jobId } = job.data;

    console.log("Processing job:", jobId);

    await resumeService.processResumes(files, jobId);
  },
  {
    connection,
    concurrency: 3,
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});
