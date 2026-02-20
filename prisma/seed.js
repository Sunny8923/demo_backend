require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { faker } = require("@faker-js/faker");
const bcrypt = require("bcrypt");

//////////////////////////////////////////////////
// SETUP
//////////////////////////////////////////////////

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

//////////////////////////////////////////////////
// CONFIG
//////////////////////////////////////////////////

const USERS_COUNT = 8;
const PARTNERS_COUNT = 4;
const JOBS_COUNT = 40;
const CANDIDATES_COUNT = 200;

//////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateLastYear() {
  return faker.date.between({
    from: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    to: new Date(),
  });
}

//////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////

async function main() {
  console.log("🌱 Clearing old non-admin data...");

  // delete dependent tables first
  await prisma.application.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();
  await prisma.partner.deleteMany();

  // delete only USER and PARTNER, keep ADMIN
  await prisma.user.deleteMany({
    where: {
      role: {
        in: ["USER", "PARTNER"],
      },
    },
  });

  //////////////////////////////////////////////////
  // HASH PASSWORD
  //////////////////////////////////////////////////

  const hashedPassword = await bcrypt.hash("password123", 10);

  //////////////////////////////////////////////////
  // USERS
  //////////////////////////////////////////////////

  console.log("Creating users...");

  const users = [];

  for (let i = 0; i < USERS_COUNT; i++) {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: hashedPassword,
        role: "USER",
        createdAt: randomDateLastYear(),
      },
    });

    users.push(user);
  }

  //////////////////////////////////////////////////
  // PARTNERS
  //////////////////////////////////////////////////

  console.log("Creating partners...");

  const partners = [];

  for (let i = 0; i < PARTNERS_COUNT; i++) {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: hashedPassword,
        role: "PARTNER",
      },
    });

    const partner = await prisma.partner.create({
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
      },
    });

    partners.push(partner);
  }

  //////////////////////////////////////////////////
  // JOBS
  //////////////////////////////////////////////////

  console.log("Creating jobs...");

  const jobs = [];

  for (let i = 0; i < JOBS_COUNT; i++) {
    // GUARANTEED UNIQUE jrCode
    const jrCode = "JR-" + Date.now() + "-" + i;

    const job = await prisma.job.create({
      data: {
        jrCode,

        title: random([
          "Frontend Developer",
          "Backend Developer",
          "Flutter Developer",
          "Full Stack Developer",
        ]),

        description: faker.lorem.paragraph(),

        department: random(["Engineering", "HR", "Sales"]),

        companyName: faker.company.name(),

        location: random(["Delhi", "Mumbai", "Bangalore"]),

        minExperience: faker.number.int({ min: 0, max: 3 }),
        maxExperience: faker.number.int({ min: 3, max: 8 }),

        salaryMin: faker.number.int({ min: 300000, max: 600000 }),
        salaryMax: faker.number.int({ min: 600000, max: 1500000 }),

        openings: faker.number.int({ min: 1, max: 5 }),

        skills: "React, Node, PostgreSQL",

        education: "Bachelor",

        status: "OPEN",

        requestDate: randomDateLastYear(),

        createdById: random(users).id,

        applicationsCount: 0,
      },
    });

    jobs.push(job);
  }

  //////////////////////////////////////////////////
  // CANDIDATES
  //////////////////////////////////////////////////

  console.log("Creating candidates...");

  const candidates = [];

  for (let i = 0; i < CANDIDATES_COUNT; i++) {
    const candidate = await prisma.candidate.create({
      data: {
        name: faker.person.fullName(),

        email: faker.internet.email(),

        phone: faker.phone.number(),

        currentLocation: random(["Delhi", "Mumbai", "Bangalore"]),

        totalExperience: faker.number.float({
          min: 0,
          max: 8,
        }),

        currentCompany: faker.company.name(),

        currentDesignation: faker.person.jobTitle(),

        skills: "React, Node",

        currentSalary: faker.number.int({
          min: 300000,
          max: 1200000,
        }),

        expectedSalary: faker.number.int({
          min: 400000,
          max: 1500000,
        }),
      },
    });

    candidates.push(candidate);
  }

  //////////////////////////////////////////////////
  // APPLICATIONS
  //////////////////////////////////////////////////

  console.log("Creating applications...");

  const stages = [
    "APPLIED",
    "SCREENING",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "HIRED",
    "REJECTED",
  ];

  for (const job of jobs) {
    const applicantsCount = faker.number.int({
      min: 5,
      max: 20,
    });

    const usedCandidates = new Set();

    for (let i = 0; i < applicantsCount; i++) {
      let candidate;

      do {
        candidate = random(candidates);
      } while (usedCandidates.has(candidate.id));

      usedCandidates.add(candidate.id);

      const stage = random(stages);

      const finalStatus =
        stage === "HIRED" ? "HIRED" : stage === "REJECTED" ? "REJECTED" : null;

      await prisma.application.create({
        data: {
          jobId: job.id,

          candidateId: candidate.id,

          pipelineStage: stage,

          finalStatus,

          source: random(["LinkedIn", "Naukri", "Referral"]),

          appliedByUserId: random(users).id,

          appliedByPartnerId: Math.random() > 0.5 ? random(partners).id : null,

          createdAt: randomDateLastYear(),
        },
      });
    }

    // update applicationsCount
    await prisma.job.update({
      where: { id: job.id },
      data: {
        applicationsCount: applicantsCount,
      },
    });
  }

  console.log("✅ PERFECT SEED COMPLETED");
}

//////////////////////////////////////////////////
// RUN
//////////////////////////////////////////////////

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
