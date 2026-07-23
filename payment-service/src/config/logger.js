const winston = require('winston');

const logger = winston.createLogger({
     level: process.env.LOG_LEVEL,
     defaultMeta: {service: process.env.SERVICE_NAME},
     format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({level, message, timestamp, service}) =>{
               const msg = typeof message === 'object' ? JSON.stringify(message) : message;
               return `[${timestamp}] [${level}] [${service}]: ${msg}`
          })
     ),
     transports: [new winston.transports.Console()]
})

module.exports = logger;