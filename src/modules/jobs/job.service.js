const prisma = require("../../config/prisma");

const fs = require("fs");
const csv = require("csv-parser");

async function createJob({ title, description, createdById }) {
  const job = await prisma.job.create({
    data: {
      title,
      description,
      createdBy: {
        connect: {
          id: createdById,
        },
      },
    },
  });

  return job;
}

async function getAllJobs() {
  const jobs = await prisma.job.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return jobs;
}

async function createJobsFromCSV(filePath, createdById) {
  return new Promise((resolve, reject) => {
    const jobs = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        // expected CSV columns: title, description
        if (row.title && row.description) {
          jobs.push({
            title: row.title,
            description: row.description,
            createdById,
          });
        }
      })
      .on("end", async () => {
        try {
          if (jobs.length === 0) {
            return reject(new Error("CSV is empty or invalid"));
          }

          // bulk insert jobs
          await prisma.job.createMany({
            data: jobs,
          });

          resolve(jobs.length);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

module.exports = {
  createJob,
  getAllJobs,
  createJobsFromCSV,
};
