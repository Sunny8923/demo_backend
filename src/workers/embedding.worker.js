require("dotenv").config();
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const prisma = require("../config/prisma");

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

console.log("🧠 EMBEDDING WORKER STARTED");

const worker = new Worker(
  "embeddingQueue",
  async (job) => {
    console.log("🧠 Processing embedding job:", job.data);

    const { type, candidateId, jobId } = job.data;

    try {
      ////////////////////////////////////////////////////////////
      /// CANDIDATE EMBEDDING
      ////////////////////////////////////////////////////////////
      if (type === "candidate") {
        const candidate = await prisma.candidate.findUnique({
          where: { id: candidateId },
        });

        if (!candidate) return;

        if (candidate.embedding) return; // skip if already done

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
      /// JOB EMBEDDING (optional reuse)
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
  },
  {
    connection,
    concurrency: 10, // 🔥 faster than resume worker
  },
);

////////////////////////////////////////////////////////////
/// EVENTS
////////////////////////////////////////////////////////////

worker.on("completed", (job) => {
  console.log(`✅ Embedding job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Embedding job ${job.id} failed:`, err.message);
});
