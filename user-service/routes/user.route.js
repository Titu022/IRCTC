const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const {getProfile} = require('../controllers/user.controller');
const router = express.Router();

router.get('/profile', getProfile);

module.exports = router;

