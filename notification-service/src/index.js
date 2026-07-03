require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const logger = require('./config/logger');
const EmailConsumer = require('./kafka/consumer/email.consumer')
async function startNotificationService(){
    try{
        logger.info('starting notification service');
        await EmailConsumer.start();
        logger.info('notification service started successfully');
        logger.info("service is now ready to process notifications");
    }
    catch(err){
        console.log(err);
        process.exit(1);
    }
}

startNotificationService();