require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");
const bcrypt = require("bcrypt");

////////////////////////////////////////////////////////////
// DB SETUP
////////////////////////////////////////////////////////////

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

////////////////////////////////////////////////////////////
// CONFIG
////////////////////////////////////////////////////////////

const USERS_COUNT = 10;
const RECRUITERS_COUNT = 8;
const PARTNERS_COUNT = 5;
const JOBS_COUNT = 50;
const CANDIDATES_COUNT = 180;
const APPLICATIONS_TARGET = 260;

////////////////////////////////////////////////////////////
// TIME HELPERS (CRITICAL FIX)
////////////////////////////////////////////////////////////

// 60–30 days ago
function randomDateOld() {
  return faker.date.between({
    from: new Date(Date.now() - 60 * 86400000),
    to: new Date(Date.now() - 30 * 86400000),
  });
}

// 30–7 days ago
function randomDateMid() {
  return faker.date.between({
    from: new Date(Date.now() - 30 * 86400000),
    to: new Date(Date.now() - 7 * 86400000),
  });
}

// last 7 days
function randomDateRecent() {
  return faker.date.between({
    from: new Date(Date.now() - 7 * 86400000),
    to: new Date(),
  });
}

// realistic weighted distribution
function randomDateRealistic() {
  const r = Math.random();

  if (r < 0.3) return randomDateOld();
  if (r < 0.7) return randomDateMid();
  return randomDateRecent();
}

////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

////////////////////////////////////////////////////////////
// PIPELINE
////////////////////////////////////////////////////////////

const PIPELINE = [
  "APPLIED",
  "SCREENING",
  "CONTACTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFER_SENT",
  "OFFER_ACCEPTED",
  "HIRED",
  "REJECTED",
];

function getFinalStatus(stage) {
  if (stage === "HIRED") return "HIRED";
  if (stage === "REJECTED") return "REJECTED";
  if (Math.random() < 0.08) return "WITHDRAWN";
  return null;
}

////////////////////////////////////////////////////////////
// MAIN
////////////////////////////////////////////////////////////

async function main() {
  console.log("🌱 Clearing database...");

  await prisma.application.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();
  await prisma.partner.deleteMany();

  await prisma.user.deleteMany({
    where: {
      role: {
        in: ["USER", "RECRUITER", "PARTNER"],
      },
    },
  });

  const password = await bcrypt.hash("password123", 10);

  ////////////////////////////////////////////////////////////
  // USERS
  ////////////////////////////////////////////////////////////

  console.log("Creating USERS...");

  const users = [];

  for (let i = 0; i < USERS_COUNT; i++) {
    users.push(
      await prisma.user.create({
        data: {
          name: faker.person.fullName(),
          email: faker.internet.email(),
          password,
          role: "USER",
          createdAt: randomDateRealistic(),
        },
      }),
    );
  }

  ////////////////////////////////////////////////////////////
  // RECRUITERS
  ////////////////////////////////////////////////////////////

  console.log("Creating RECRUITERS...");

  const recruiters = [];

  for (let i = 0; i < RECRUITERS_COUNT; i++) {
    recruiters.push(
      await prisma.user.create({
        data: {
          name: faker.person.fullName(),
          email: faker.internet.email(),
          password,
          role: "RECRUITER",
          createdAt: randomDateRealistic(),
        },
      }),
    );
  }

  ////////////////////////////////////////////////////////////
  // PARTNERS
  ////////////////////////////////////////////////////////////

  console.log("Creating PARTNERS...");

  const partners = [];

  for (let i = 0; i < PARTNERS_COUNT; i++) {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password,
        role: "PARTNER",
        createdAt: randomDateRealistic(),
      },
    });

    partners.push(
      await prisma.partner.create({
        data: {
          organisationName: faker.company.name(),
          ownerName: faker.person.fullName(),
          establishmentDate: faker.date.past(),

          gstNumber: faker.string.alphanumeric(15),
          panNumber: faker.string.alphanumeric(10),

          address: faker.location.streetAddress(),
          contactNumber: faker.phone.number(),
          officialEmail: faker.internet.email(),

          status: "APPROVED",

          userId: user.id,

          createdAt: randomDateRealistic(),
        },
      }),
    );
  }

  ////////////////////////////////////////////////////////////
  // JOBS
  ////////////////////////////////////////////////////////////

  console.log("Creating JOBS...");

  const jobs = [];

  for (let i = 0; i < JOBS_COUNT; i++) {
    const createdAt = randomDateRealistic();

    jobs.push(
      await prisma.job.create({
        data: {
          jrCode: `JR-${1000 + i}`,

          title: faker.person.jobTitle(),

          description: faker.lorem.paragraph(),

          companyName: faker.company.name(),

          location: faker.location.city(),

          status: random(["OPEN", "OPEN", "OPEN", "CLOSED"]),

          requestDate: createdAt,

          createdById: random(recruiters).id,

          createdAt,
        },
      }),
    );
  }

  ////////////////////////////////////////////////////////////
  // CANDIDATES
  ////////////////////////////////////////////////////////////

  console.log("Creating CANDIDATES...");

  const candidates = [];

  for (let i = 0; i < CANDIDATES_COUNT; i++) {
    candidates.push(
      await prisma.candidate.create({
        data: {
          name: faker.person.fullName(),
          email: faker.internet.email(),
          phone: faker.phone.number(),

          totalExperience: faker.number.float({
            min: 0,
            max: 10,
            fractionDigits: 1,
          }),

          currentCompany: faker.company.name(),
          currentDesignation: faker.person.jobTitle(),

          skills: "React, Node",

          currentSalary: faker.number.int({
            min: 300000,
            max: 1500000,
          }),

          expectedSalary: faker.number.int({
            min: 400000,
            max: 2000000,
          }),

          createdByUserId: Math.random() < 0.5 ? random(recruiters).id : null,

          createdByPartnerId: Math.random() < 0.5 ? random(partners).id : null,

          createdAt: randomDateRealistic(),
        },
      }),
    );
  }

  ////////////////////////////////////////////////////////////
  // APPLICATIONS
  ////////////////////////////////////////////////////////////

  console.log("Creating APPLICATIONS...");

  const jobCounts = {};

  async function createApplication({
    job,
    candidate,
    userId,
    partnerId,
    createdAt,
  }) {
    const stage = random(PIPELINE);

    await prisma.application
      .create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,

          appliedByUserId: userId || null,
          appliedByPartnerId: partnerId || null,

          pipelineStage: stage,
          finalStatus: getFinalStatus(stage),

          source: random(["LinkedIn", "Naukri", "Referral"]),

          createdAt,
        },
      })
      .catch(() => {});

    jobCounts[job.id] = (jobCounts[job.id] || 0) + 1;
  }

  // 1 application per user (recent)
  for (const user of users) {
    await createApplication({
      job: random(jobs),
      candidate: random(candidates),
      userId: user.id,
      createdAt: randomDateRecent(),
    });
  }

  // remaining applications
  for (let i = 0; i < APPLICATIONS_TARGET - USERS_COUNT; i++) {
    await createApplication({
      job: random(jobs),
      candidate: random(candidates),

      userId: Math.random() < 0.4 ? random(recruiters).id : null,

      partnerId: Math.random() < 0.3 ? random(partners).id : null,

      createdAt: randomDateRealistic(),
    });
  }

  ////////////////////////////////////////////////////////////
  // UPDATE COUNTS
  ////////////////////////////////////////////////////////////

  for (const jobId in jobCounts) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        applicationsCount: jobCounts[jobId],
      },
    });
  }

  console.log("✅ SEED COMPLETED SUCCESSFULLY");
}

////////////////////////////////////////////////////////////
// RUN
////////////////////////////////////////////////////////////

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
