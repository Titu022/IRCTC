const express = require('express');
const {getUserContext} = require('../middlewares/getUserContext.middleware');
const {createTrain} = require('../controllers/train.controller');

const router = express.Router();

router.post('/train', getUserContext, createTrain);

module.exports = router;