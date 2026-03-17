const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const resumeQueue = new Queue("resumeQueue", {
  connection,
});

module.exports = resumeQueue;
