const { BadRequestError } = require("../utils/error");


exports.createBooking = asyncHandler(async(req, res) => {
     const userId = req.user.id;
     const {scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq} = req.body;
     if(!userId || !scheduleId || !seatIds || !passengers || !idempotencyKey){
          throw new BadRequestError(`scheduleId, seatIds, passengers, idempotencykey are required`);
     }

     const result = await bookingService.createBooking(userId, scheduleId, seatIds, passengers, idempotencyKey, fromStationId, toStationId, fromSeq, toSeq);
     return res.status(201).json({
          success: true,
          data: result
     });
})