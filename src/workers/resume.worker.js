require("dotenv").config();
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

console.log("🔥 WORKER FILE LOADED");
console.log("🔥 WORKER LOADED CORRECTLY");

const worker = new Worker(
  "resumeQueue",
  async (job) => {
    console.log("Processing job:", job.name, job.data);

    ////////////////////////////////////////////////////////////
    /// ✅ RESUME JOB
    ////////////////////////////////////////////////////////////
    if (job.name === "resume-upload") {
      console.log("✅ Resume job started");

      const { files, jobId, total } = job.data;

      return await resumeService.processResumes(files, jobId, job, total);
    }

    ////////////////////////////////////////////////////////////
    /// ✅ CSV JOB (CANDIDATE CSV)
    ////////////////////////////////////////////////////////////
    if (job.name === "csvUpload") {
      const { jobId, fileUrl, fileName } = job.data;

      console.log("📄 Processing CSV job:", jobId);

      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);

      const { summary } = await csvService.processCSVBuffer(buffer, fileName);

      await prisma.uploadJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          total: summary.total,
          processed: summary.total,
          created: summary.created,
          duplicate: summary.duplicate,
          skipped: summary.skipped,
          error: summary.error,
          results: summary,
        },
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    /// ✅ EMBEDDING JOB (NEW - VERY IMPORTANT)
    ////////////////////////////////////////////////////////////
    if (job.name === "embedding") {
      const { type, candidateId, jobId } = job.data;

      console.log("🧠 Embedding job:", type, candidateId || jobId);

      try {
        ////////////////////////////////////////////////////////////
        /// 🔹 CANDIDATE EMBEDDING
        ////////////////////////////////////////////////////////////
        if (type === "candidate") {
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
          });

          if (!candidate) return;

          // avoid duplicate work
          if (candidate.embedding) return;

          const {
            buildCandidateEmbeddingText,
            getEmbedding,
          } = require("../utils/embedding");

          const text = buildCandidateEmbeddingText({
            skillsArray: candidate.skillsArray || [],
            totalExperience: candidate.totalExperience,
            currentRole: candidate.currentDesignation,
          });

          const embedding = await getEmbedding(text);

          await prisma.candidate.update({
            where: { id: candidateId },
            data: { embedding },
          });

          console.log("✅ Candidate embedding done:", candidateId);
        }

        ////////////////////////////////////////////////////////////
        /// 🔹 JOB EMBEDDING
        ////////////////////////////////////////////////////////////
        if (type === "job") {
          const jobData = await prisma.job.findUnique({
            where: { id: jobId },
          });

          if (!jobData) return;

          if (jobData.embedding) return;

          const {
            buildJobEmbeddingText,
            getEmbedding,
          } = require("../utils/embedding");

          const text = buildJobEmbeddingText({
            title: jobData.title,
            skillsArray: jobData.skillsArray || [],
            minExperience: jobData.minExperience,
          });

          const embedding = await getEmbedding(text);

          await prisma.job.update({
            where: { id: jobId },
            data: { embedding },
          });

          console.log("✅ Job embedding done:", jobId);
        }

        return;
      } catch (err) {
        console.error("❌ Embedding failed:", err.message);
        throw err; // important for retry
      }
    }

    ////////////////////////////////////////////////////////////
    /// UNKNOWN JOB
    ////////////////////////////////////////////////////////////
    console.warn("❌ Unknown job type:", job.name);
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
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);

  try {
    if (job?.data?.jobId) {
      await prisma.uploadJob.update({
        where: { id: job.data.jobId },
        data: {
          status: "failed",
          error: 1,
        },
      });
    }
  } catch (e) {
    console.error("Failed to update job status:", e);
  }
});

worker.on("stalled", (jobId) => {
  console.warn(`⚠️ Job stalled: ${jobId}`);
});
