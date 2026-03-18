const prisma = require("../config/prisma");

async function recoverJobs() {
  try {
    const TEN_MINUTES = 10 * 60 * 1000;

    const stuckJobs = await prisma.uploadJob.findMany({
      where: {
        status: "processing",
        updatedAt: {
          lt: new Date(Date.now() - TEN_MINUTES),
        },
      },
    });

    for (const job of stuckJobs) {
      await prisma.uploadJob.update({
        where: { id: job.id },
        data: { status: "failed" },
      });

      console.log("Recovered stuck job:", job.id);
    }
  } catch (err) {
    console.error("Recover job error:", err);
  }
}

module.exports = recoverJobs;
