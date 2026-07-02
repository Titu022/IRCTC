const { AppError } = require('../utils/error');
const {config} = require('../config');
const logger = require('../config/logger');

module.exports = (err, req, res, next) => {
     if (err instanceof AppError) {
          return res.status(err.statusCode).json({
               success: false,
               error: err.code,
               message: err.message
          });
     }

     if (err.code === 'P2002') {
     return res.status(409).json({
          success: false,
          message: "Account already exists, please try logging in again"
     });
     }
     
     console.error("UNHANDLED ERROR:", err);

     if(config.NODE_ENV !== "production"){
          logger.error({
               message: err.message,
               stack: err.stack,
               path: req.path,
               method: req.method,
               body: req.body,
               query: req.query
          })
     }
     return res.status(500).json({
          success: false,
          error: "SERVER_ERROR",
          message: "Internal Server Error"
     });
};