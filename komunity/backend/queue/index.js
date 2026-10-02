const { Queue, Worker } = require('bullmq');
const { processors } = require('./processors');

const QUEUE_NAMES = ['webhooks', 'emails'];
const REDIS_URL = process.env.REDIS_URL;

// Parse REDIS_URL into ioredis options so BullMQ manages its own connections
// (recommended over sharing a single instance between Queue and Worker).
function connectionOpts() {
  if (!REDIS_URL) return null;
  try {
    const u = new URL(REDIS_URL);
    return {
      host: u.hostname,
      port: Number(u.port) || 6379,
      username: u.username || undefined,
      password: u.password || undefined,
      maxRetriesPerRequest: null, // required by BullMQ
    };
  } catch {
    return null;
  }
}

const conn = connectionOpts();
const queues = {};
const workers = [];

function getQueue(name) {
  if (!conn) return null;
  if (!queues[name]) queues[name] = new Queue(name, { connection: conn });
  return queues[name];
}

async function runInline(queueName, jobName, data) {
  try {
    await processors[queueName]({ name: jobName, data });
  } catch (e) {
    console.error(`[queue:inline] ${queueName}.${jobName} failed:`, e.message);
  }
}

/**
 * Enqueue a job. Falls back to running inline when Redis/BullMQ is unavailable,
 * so the app degrades gracefully in dev or if the queue is down.
 */
async function enqueue(queueName, jobName, data, opts = {}) {
  const q = getQueue(queueName);
  if (q) {
    try {
      await q.add(jobName, data, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
        ...opts,
      });
      return;
    } catch (e) {
      console.error(`[queue] enqueue ${queueName}.${jobName} failed, running inline:`, e.message);
    }
  }
  await runInline(queueName, jobName, data);
}

// Start in-process workers (fine for single-node; scale out to separate workers later).
function startWorkers() {
  if (!conn) {
    console.log('[queue] REDIS_URL not set — workers disabled (jobs run inline).');
    return;
  }
  for (const name of QUEUE_NAMES) {
    const w = new Worker(name, async (job) => processors[name](job), { connection: conn });
    w.on('failed', (job, err) => console.error(`[queue:${name}] job ${job?.id} failed:`, err?.message));
    workers.push(w);
  }
  console.log('[queue] workers started:', QUEUE_NAMES.join(', '));
}

async function close() {
  await Promise.allSettled(workers.map(w => w.close()));
  await Promise.allSettled(Object.values(queues).map(q => q.close()));
}

module.exports = { enqueue, startWorkers, close, QUEUE_NAMES };
