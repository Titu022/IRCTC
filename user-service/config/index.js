require('dotenv').config();
const config = {
    SERVICE_NAME: require('../package.json').name,
    PORT: Number(process.env.PORT) || 3201,
    NODE_ENV: process.env.NODE_ENV || "developement",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    REDIS_URL: process.env.REDIS_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3200"
};