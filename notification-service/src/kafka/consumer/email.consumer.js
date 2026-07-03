const { consumer } = require('../../config/kafka');
const emailService = require('../../services/email.service');
const { TOPICS } = require('../../utils/constants');
const logger = require('../../config/logger');

class EmailConsumer {
    async start() {
        try {
            await consumer.connect();
            logger.info('Email consumer connected to kafka');
            await consumer.subscribe({
                topics: Object.values(TOPICS),
            });

            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const value = JSON.parse(message.value.toString());
                        logger.info(`processing message from topic: ${topic}`, {
                            partition,
                            offset: message.offset
                        });
                        await this.handleMessage(topic, value);
                    } catch (err) {
                        logger.error("error processing message", {
                            error: err.message,
                            stack: err.stack,
                            topic
                        });
                    }
                }
            });
        } catch (err) {
            logger.error("failed to start email consumer", {
                error: err.message,
                stack: err.stack
            });
        }
    }
    
    async handleMessage(topic, data) {
          switch (topic) {
               case TOPICS.OTP_EMAIL:
                    await this.handleOtpEmail(data);
                    break;

               case TOPICS.WELCOME_EMAIL:
                    await this.handleWelcomeEmail(data);
                    break;
        }
    } 

    async handleOtpEmail(data) {
          const { email, otp, ttlMinutes } = data;

          if (!email || !otp) {
               throw new Error('Missing required fields: email or otp');
          }

          await emailService.sendOtpEmail(email, otp, ttlMinutes || 5);
          logger.info(`OTP email sent to ${email}`);
    }

    async handleWelcomeEmail(data) {
          const { email, firstName } = data;

          if (!email || !firstName) {
               throw new Error('Missing required fields: email or firstName');
          }

          await emailService.sendWelcomeEmail(email, firstName);
          logger.info(`Welcome email sent to ${email}`);
    }
}

module.exports = new EmailConsumer();