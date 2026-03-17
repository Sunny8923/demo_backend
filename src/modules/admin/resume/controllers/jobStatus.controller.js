const prisma = require("../../../../config/prisma");

async function getJobStatus(req, res) {
  try {
    const { jobId } = req.params;

    const job = await prisma.uploadJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      status: job.status,
      total: job.total,
      processed: job.processed,
      progress: `${job.processed}/${job.total}`,

      created: job.created,
      duplicate: job.duplicate,
      skipped: job.skipped,
      error: job.error,

      results: job.status === "completed" ? job.results : null,
    });
  } catch (error) {
    console.error("Job status error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  getJobStatus,
};
