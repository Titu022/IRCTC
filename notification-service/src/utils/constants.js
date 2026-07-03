const TOPICS = {
    OTP_EMAIL: 'notification.otp-email',
    WELCOME_EMAIL: 'notification.welcome-email',
}

const DLQ_MAX_RETRIES = 3;

module.exports = {TOPICS, DLQ_MAX_RETRIES };