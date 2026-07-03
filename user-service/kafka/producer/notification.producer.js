const { producer, connectProducer } = require('../../config/kafka');
const logger = require('../../config/logger');
const { TOPICS } = require('../../utils/constants/kafka-topics');

class NotificationProducer {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            await connectProducer();
            this.isInitialized = true;
        }
    }

    async sendMessage(topic, key, value) {
        try {
            await this.initialize();
            const message = {
                topic,
                messages: [{
                    key: key || `${topic}-${Date.now()}`,
                    value: JSON.stringify(value),
                    timestamp: Date.now().toString()
                }]
            };
            const result = await producer.send(message);
            logger.info(`message sent to kafka topic ${topic}`);
            return result;
        } catch (err) {
            logger.error(`failed to send message to kafka topic: ${topic}`, {
                error: err.message,
                stack: err.stack,
                key
            });
            throw err;
        }
    }

    async sendOtpEmail(email, otp, ttlMinutes) {
        return this.sendMessage(
            TOPICS.OTP_EMAIL,
            `otp-${email}`,
            { email, otp, ttlMinutes }
        );
    }
    async sendWelcomeEmail(email, firstName){
        return this.sendMessage(
            TOPICS.WELCOME_EMAIL,
            `welcome-${email}`,
            {email, firstName}
        );
    }
}

module.exports = new NotificationProducer();