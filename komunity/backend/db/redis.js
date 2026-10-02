const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('🔗 Connected to Redis');
});

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
      // In a real production app we might exit or retry. 
      // For MVP, we let it try to reconnect on its own.
    }
  }
};

module.exports = { redisClient, connectRedis };
