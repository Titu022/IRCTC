const express = require('express');

const {getUserContext} = require('../middlewares/getUserContext.middleware');
const {createStation, getAllStations, getStationById} = require('../controllers/station.controller');

const router = express.Router();

router.get("/station/internal/:stationId", internalAuth, getStationByIdInternal);

router.get("/station", getUserContext, getAllStations);
router.get("/station/:stationId", getUserContext, getStationById);

router.post("/station", getUserContext, createStation);

module.exports = router;