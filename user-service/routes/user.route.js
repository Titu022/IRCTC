const express = require('express');
const getUserContext = require('../middlewares/getUserContext.middleware')
const {getProfile} = require('../controllers/user.controller');
const router = express.Router();

router.get('/profile', getUserContext, getProfile);

module.exports = router;

