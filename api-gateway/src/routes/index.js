const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { ipRateLimit, endpointRateLimit, combinedRateLimit } = require('../middlewares/rateLimiting.middleware');
const { createProxy } = require('../services/proxy');
const router = express.Router();

// createProxy must NOT be async — see note above
const userServiceProxy = createProxy('userService', process.env.USER_SERVICE_URL);

// --- Auth flow (public, no requireAuth — these ARE the auth endpoints) ---
router.post('/users/auth/send-otp', endpointRateLimit(5, 900000), userServiceProxy);
router.post('/users/auth/verify-otp', endpointRateLimit(5, 900000), userServiceProxy);
router.post('/users/auth/login', endpointRateLimit(10, 900000), userServiceProxy);
router.get('/users/auth/refresh', endpointRateLimit(20, 900000), userServiceProxy);
router.post('/users/auth/google-auth', endpointRateLimit(10, 900000), userServiceProxy);

// --- Authenticated user routes ---
router.get('/users/user/profile', requireAuth, combinedRateLimit(), userServiceProxy);

// --- Gateway health check ---
router.get('/gateway/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: "API gateway is healthy",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;