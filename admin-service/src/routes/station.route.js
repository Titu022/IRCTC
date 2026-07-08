const express = require('express');

const {getUserContext} = require('../middlewares/getUserContext.middleware');
const {createStation} = require('../controllers/station.controller');

const router = express.Router();

router.post("/station", getUserContext, createStation);

module.exports = router;