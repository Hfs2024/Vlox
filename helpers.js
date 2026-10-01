import schemas from "./schemas.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { validationResult, matchedData } from "express-validator";
import config from "./config/backend.js";

export async function checkAuth(req, res, next) {
    if (!req.session.isLoggedIn || !req.session.userId) return res.status(401).json({ error: "You are not logged in!" });
    const user = await schemas.Users.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Can't find your account right now!" });

    req.currentUser = user;
    next();
}

export async function generateRecoveryCodes(count = config.RECOVERY_CODE_COUNT) {
    const recoveryCodesHashed = [];
    const recoveryCodesRaw = [];

    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(config.RECOVERY_CODE_RANDOM_BYTES).toString("hex");
        const hashed = await bcrypt.hash(code, config.BCRYPT_SALT_ROUNDS);
        recoveryCodesRaw.push(code);
        recoveryCodesHashed.push(hashed);
    }

    return {
        hashed: recoveryCodesHashed,
        raw: recoveryCodesRaw
    };
}

export const hotQueries = {
    modify_post: (postId, userId) => {
        return {
            by: userId,
            _id: postId
        };
    },

    view_post: (postId, userId) => {
        return {
            _id: postId,
            $or: [
                { by: userId },
                { private: false }
            ]
        };
    }
};

export function createLimiter(
    windowMs = config.RATE_LIMIT_WINDOW_MS,
    limit = config.MAIN_RATE_LIMIT_MAX_REQ,
    options = {},
    error = "Too Many Requests. Please try again later."
) {
    try {
        return rateLimit({
            windowMs: windowMs,
            limit: limit,
            message: {
                status: 429,
                error: error,
            },
            standardHeaders: true,
            legacyHeaders: false,
            ...options
        });
    } catch (e) {
        console.log("Error:", e);
        return null;
    }
}

export function validateResult(req, res, next) {
    const result = validationResult(req);
    if (!result.isEmpty()) return res.status(400).json({ error: "Invalid request!" });

    // Result
    const cleanData = matchedData(req);
    req.cleanData = cleanData;
    next();
}