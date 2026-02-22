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

const USERS_COUNT = 12;
const RECRUITERS_COUNT = 8;
const PARTNERS_COUNT = 5;
const JOBS_COUNT = 60;
const CANDIDATES_COUNT = 400;

////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////

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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

////////////////////////////////////////////////////////////
// PIPELINE STAGES ORDER
////////////////////////////////////////////////////////////

const PIPELINE = [
  "APPLIED",
  "SCREENING",
  "CONTACTED",
  "DOCUMENT_REQUESTED",
  "DOCUMENT_RECEIVED",
  "SUBMITTED_TO_CLIENT",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "SHORTLISTED",
  "OFFER_SENT",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
  "HIRED",
  "REJECTED",
];

////////////////////////////////////////////////////////////
// FINAL STATUS MAP
////////////////////////////////////////////////////////////

function getFinalStatus(stage) {
  if (stage === "HIRED") return "HIRED";
  if (stage === "REJECTED") return "REJECTED";

  if (Math.random() < 0.1) return "WITHDRAWN";

  return null;
}

////////////////////////////////////////////////////////////
// MAIN SEED
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

  ////////////////////////////////////////////////////////////
  // PASSWORD
  ////////////////////////////////////////////////////////////

  const password = await bcrypt.hash("password123", 10);

  ////////////////////////////////////////////////////////////
  // USERS
  ////////////////////////////////////////////////////////////

  console.log("Creating USERS...");

  const users = [];

  for (let i = 0; i < USERS_COUNT; i++) {
    const u = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password,
        role: "USER",
        createdAt: randomDateLast60Days(),
      },
    });

    users.push(u);
  }

  ////////////////////////////////////////////////////////////
  // RECRUITERS
  ////////////////////////////////////////////////////////////

  console.log("Creating RECRUITERS...");

  const recruiters = [];

  for (let i = 0; i < RECRUITERS_COUNT; i++) {
    const r = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password,
        role: "RECRUITER",
        createdAt: randomDateLast60Days(),
      },
    });

    recruiters.push(r);
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

        status: random(["APPROVED", "PENDING"]),

        userId: user.id,

        createdAt: randomDateLast60Days(),
      },
    });

    partners.push(partner);
  }

  ////////////////////////////////////////////////////////////
  // JOBS
  ////////////////////////////////////////////////////////////

  console.log("Creating JOBS...");

  const jobs = [];

  for (let i = 0; i < JOBS_COUNT; i++) {
    const requestDate = randomDateLast60Days();

    const status = random([
      "OPEN",
      "OPEN",
      "OPEN",
      "CLOSED",
      "ON_HOLD",
      "CANCELLED",
    ]);

    const job = await prisma.job.create({
      data: {
        jrCode: `JR-${1000 + i}`,

        title: faker.person.jobTitle(),

        description: faker.lorem.paragraph(),

        department: random(["Engineering", "HR", "Finance", "Marketing"]),

        companyName: faker.company.name(),

        location: random([
          "Delhi",
          "Bangalore",
          "Mumbai",
          "Hyderabad",
          "Remote",
        ]),

        minExperience: faker.number.int({ min: 0, max: 3 }),
        maxExperience: faker.number.int({ min: 3, max: 10 }),

        salaryMin: faker.number.int({ min: 300000, max: 800000 }),
        salaryMax: faker.number.int({ min: 800000, max: 2500000 }),

        openings: faker.number.int({ min: 1, max: 10 }),

        skills: faker.helpers
          .arrayElements(["React", "Node", "Flutter", "Java", "Python"], 3)
          .join(", "),

        education: random(["B.Tech", "M.Tech", "BCA", "MCA", "MBA"]),

        status,

        requestDate,

        closureDate:
          status === "CLOSED"
            ? addDays(requestDate, faker.number.int({ min: 5, max: 30 }))
            : null,

        createdById: random(recruiters).id,

        createdAt: requestDate,
      },
    });

    jobs.push(job);
  }

  ////////////////////////////////////////////////////////////
  // CANDIDATES
  ////////////////////////////////////////////////////////////

  console.log("Creating CANDIDATES...");

  const candidates = [];

  for (let i = 0; i < CANDIDATES_COUNT; i++) {
    const createdAt = randomDateLast60Days();

    const c = await prisma.candidate.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),

        currentLocation: faker.location.city(),
        preferredLocations: faker.location.city(),
        hometown: faker.location.city(),
        pincode: faker.location.zipCode(),

        totalExperience: faker.number.float({
          min: 0,
          max: 12,
          fractionDigits: 1,
        }),

        currentCompany: faker.company.name(),
        currentDesignation: faker.person.jobTitle(),
        department: random(["Engineering", "HR", "Finance"]),
        industry: random(["IT", "Finance", "Healthcare"]),
        skills: faker.helpers
          .arrayElements(["React", "Node", "Flutter", "Java"], 3)
          .join(", "),

        currentSalary: faker.number.int({
          min: 300000,
          max: 2000000,
        }),

        expectedSalary: faker.number.int({
          min: 400000,
          max: 2500000,
        }),

        noticePeriodDays: faker.number.int({
          min: 0,
          max: 90,
        }),

        highestQualification: random(["B.Tech", "M.Tech", "MBA"]),

        specialization: faker.person.jobArea(),
        university: faker.company.name(),
        graduationYear: faker.number.int({
          min: 2005,
          max: 2023,
        }),

        gender: random(["Male", "Female"]),

        createdByUserId: Math.random() < 0.5 ? random(recruiters).id : null,

        createdByPartnerId: Math.random() < 0.5 ? random(partners).id : null,

        createdAt,
      },
    });

    candidates.push(c);
  }

  ////////////////////////////////////////////////////////////
  // APPLICATIONS
  ////////////////////////////////////////////////////////////

  console.log("Creating APPLICATIONS...");

  let jobCounts = {};

  async function createApplication({ job, candidate, userId, partnerId }) {
    const stage = random(PIPELINE);
    const createdAt = randomDateLast60Days();

    await prisma.application
      .create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,

          appliedByUserId: userId || null,
          appliedByPartnerId: partnerId || null,

          pipelineStage: stage,

          finalStatus: getFinalStatus(stage),

          source: random(["LinkedIn", "Naukri", "Referral", "Direct"]),

          notes: faker.lorem.sentence(),

          contactedAt: stage !== "APPLIED" ? addDays(createdAt, 1) : null,

          interviewScheduledAt: stage.includes("INTERVIEW")
            ? addDays(createdAt, 3)
            : null,

          hiredAt: stage === "HIRED" ? addDays(createdAt, 10) : null,

          rejectedAt: stage === "REJECTED" ? addDays(createdAt, 5) : null,

          createdAt,
        },
      })
      .catch(() => {});

    jobCounts[job.id] = (jobCounts[job.id] || 0) + 1;
  }

  // USER APPLICATIONS (1 per user guaranteed)

  for (const user of users) {
    await createApplication({
      job: random(jobs),
      candidate: random(candidates),
      userId: user.id,
    });
  }

  // BULK APPLICATIONS

  for (let i = 0; i < 800; i++) {
    await createApplication({
      job: random(jobs),
      candidate: random(candidates),
      userId: Math.random() < 0.5 ? random(recruiters).id : null,
      partnerId: Math.random() < 0.3 ? random(partners).id : null,
    });
  }

  ////////////////////////////////////////////////////////////
  // UPDATE JOB COUNTS
  ////////////////////////////////////////////////////////////

  console.log("Updating job counts...");

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
