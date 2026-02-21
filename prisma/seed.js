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
const RECRUITERS_COUNT = 6;
const PARTNERS_COUNT = 4;
const JOBS_COUNT = 50;
const CANDIDATES_COUNT = 300;

//////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateLast60Days() {
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 60);

  return faker.date.between({
    from: past,
    to: now,
  });
}

function randomFutureDate(from, maxDays = 30) {
  const d = new Date(from);
  d.setDate(d.getDate() + faker.number.int({ min: 1, max: maxDays }));
  return d;
}

//////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////

async function main() {
  console.log("🌱 Clearing old data...");

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

  //////////////////////////////////////////////////
  // PASSWORD
  //////////////////////////////////////////////////

  const hashedPassword = await bcrypt.hash("password123", 10);

  //////////////////////////////////////////////////
  // USERS (NORMAL USERS)
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
        createdAt: randomDateLast60Days(),
      },
    });

    users.push(user);
  }

  //////////////////////////////////////////////////
  // RECRUITERS
  //////////////////////////////////////////////////

  console.log("Creating recruiters...");

  const recruiters = [];

  for (let i = 0; i < RECRUITERS_COUNT; i++) {
    const recruiter = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: hashedPassword,
        role: "RECRUITER",
        createdAt: randomDateLast60Days(),
      },
    });

    recruiters.push(recruiter);
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
        createdAt: randomDateLast60Days(),
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

        msmeRegistered: faker.datatype.boolean(),

        status: "APPROVED",

        userId: user.id,

        createdAt: randomDateLast60Days(),
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
    const requestDate = randomDateLast60Days();

    const status =
      Math.random() > 0.8 ? "CLOSED" : Math.random() > 0.7 ? "ON_HOLD" : "OPEN";

    const job = await prisma.job.create({
      data: {
        jrCode: "JR-" + Date.now() + "-" + i,

        title: random([
          "Frontend Developer",
          "Backend Developer",
          "Flutter Developer",
          "Full Stack Developer",
        ]),

        description: faker.lorem.paragraph(),

        department: "Engineering",

        companyName: faker.company.name(),

        location: random(["Delhi", "Bangalore", "Mumbai", "Remote"]),

        minExperience: faker.number.int({ min: 0, max: 3 }),
        maxExperience: faker.number.int({ min: 3, max: 8 }),

        salaryMin: faker.number.int({
          min: 300000,
          max: 700000,
        }),

        salaryMax: faker.number.int({
          min: 700000,
          max: 2000000,
        }),

        openings: faker.number.int({ min: 1, max: 5 }),

        skills: "React, Node",

        education: "Bachelor",

        status,

        requestDate,

        createdById: random(recruiters).id,
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

        totalExperience: faker.number.float({
          min: 0,
          max: 10,
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

        createdByUserId: Math.random() > 0.5 ? random(recruiters).id : null,

        createdByPartnerId: Math.random() > 0.5 ? random(partners).id : null,

        createdAt: randomDateLast60Days(),
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
    "HIRED",
    "REJECTED",
  ];

  const usedUsers = new Set();

  // USER applications (1 user = 1 application)
  for (const user of users) {
    const job = random(jobs);
    const candidate = random(candidates);

    await prisma.application.create({
      data: {
        jobId: job.id,
        candidateId: candidate.id,

        appliedByUserId: user.id,

        pipelineStage: random(stages),

        source: "USER_PORTAL",

        createdAt: randomDateLast60Days(),
      },
    });

    usedUsers.add(user.id);
  }

  // Recruiter & Partner applications
  for (const job of jobs) {
    const count = faker.number.int({ min: 5, max: 15 });

    for (let i = 0; i < count; i++) {
      const candidate = random(candidates);

      await prisma.application
        .create({
          data: {
            jobId: job.id,
            candidateId: candidate.id,

            appliedByUserId: Math.random() > 0.5 ? random(recruiters).id : null,

            appliedByPartnerId:
              Math.random() > 0.6 ? random(partners).id : null,

            pipelineStage: random(stages),

            source: random(["LinkedIn", "Naukri", "Referral"]),

            createdAt: randomDateLast60Days(),
          },
        })
        .catch(() => {});
    }
  }

  console.log("✅ SEED COMPLETED WITH USERS APPLICATIONS");
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
