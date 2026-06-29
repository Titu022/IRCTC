const winston = require('winston');

const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     defaultMeta: { service: process.env.npm_package_name || 'user-service' },
     format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({level, message, timestamp, service}) => {
               return `[${timestamp}] [${level}] [${service}]: ${message}`
          })
     ),
     transports: [new winston.transports.Console()]
});

module.exports = logger;