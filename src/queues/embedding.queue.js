const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const embeddingQueue = new Queue("embeddingQueue", {
  connection,
});

module.exports = embeddingQueue;
