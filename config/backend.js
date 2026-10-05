import "dotenv/config";
import sharedConfig from "./shared.js";

const config = {
    ...sharedConfig,

    // Server and session
    MAX_SESSION_AGE: 3600000,
    JSON_BODY_LIMIT: "10mb",
    HOST: "0.0.0.0",

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 900000,
    MAIN_RATE_LIMIT_MAX_REQ: 1000,
    AUTH_RATE_LIMIT_MAX_REQ: 10,

    // Password and recovery code security
    RECOVERY_CODE_COUNT: 3,
    RECOVERY_CODE_RANDOM_BYTES: 10,
    BCRYPT_SALT_ROUNDS: 10,

    // Environment values
    MONGO_URI: process.env.MONGO_URI,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,

    // Gifts
    GIFT_NAME_MAX_LENGTH: 100,
    GIFT_USES_MAX: 100,

    // Replies
    COMMENT_REPLIES_DEPTH_MAX: 5,
};

export default config;