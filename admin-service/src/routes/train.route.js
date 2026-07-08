const express = require('express');
const {getUserContext} = require('../middlewares/getUserContext.middleware');
const {createTrain, getAllTrains, getTrainById} = require('../controllers/train.controller');

const router = express.Router();

router.post('/train', getUserContext, createTrain);

router.get("/train", getUserContext, getAllTrains);
router.get("/train/:trainId", getUserContext, getTrainById);

module.exports = router;