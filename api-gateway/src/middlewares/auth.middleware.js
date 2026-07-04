const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/error');
const logger = require('../config/logger');

function requireAuth(req, res, next) {
     try {
          let accessToken;

          // 1. Try Authorization header (service-to-service / mobile clients)
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
               accessToken = authHeader.split(' ')[1];
          }

          // 2. Fall back to httpOnly cookie (browser clients)
          if (!accessToken && req.cookies) {
               accessToken = req.cookies.accessToken;
          }

          if (!accessToken) {
               throw new UnauthorizedError('Authorization token missing');
          }

          // Verify access token
          const payload = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);

          if (!payload.id) {
               throw new UnauthorizedError('Invalid token payload');
          }

          // Attach user context to request for downstream services
          req.user = {
               id: payload.id,
          };

          // Add user ID to headers for proxied requests
          req.headers['x-user-id'] = payload.id.toString();

          logger.debug(`User ${payload.id} authenticated successfully`);

          next();
     } catch (err) {
          if (err.name === 'TokenExpiredError') {
               return next(new UnauthorizedError('Access token expired', 'TOKEN_EXPIRED'));
          }
          if (err.name === 'JsonWebTokenError') {
               return next(new UnauthorizedError('Invalid access token', 'TOKEN_INVALID'));
          }
          return next(err);
     }
}

module.exports = { requireAuth };