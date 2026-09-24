const schemas = require("./schemas.js");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const { validationResult, matchedData } = require("express-validator");

// Check auth
async function checkAuth(req, res, next) {
    if (!req.session.isLoggedIn || !req.session.userId) return res.status(400).json({ error: "You are not logged in!" });
    const foundUser = await schemas.Users.findById(req.session.userId);
    if (!foundUser) return res.status(400).json({ error: "Can't find your account right now!" });

    req.currentUser = foundUser;
    next();
}

// Generate recovery codes
async function generateRecoveryCodes(count = 3) {
    if (!Number.isInteger(count)) return console.log("Count must be a type of number.");
    const recoveryCodesHashed = [];
    const recoveryCodesRaw = [];

    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(10).toString("hex");
        const hashed = await bcrypt.hash(code, 10);
        recoveryCodesRaw.push(code);
        recoveryCodesHashed.push(hashed);
    }

    return {
        hashed: recoveryCodesHashed,
        raw: recoveryCodesRaw
    }
}

// Hot queries
const hotQueries = {
    modify_post: (postId, userId) => {
        return {
            by: userId,
            _id: postId
        }
    },

    view_post: (postId, userId) => {
        return {
            _id: postId,
            $or: [
                { by: userId },
                { private: false },
            ]
        }
    }
}

// Create limiter
function createLimiter(windowMs = 900000, limit = 1000, options = {}, error = "Too Many Requests. Please try again later.") {
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

// Validate result
function validateResult(req, res, next) {
    const result = validationResult(req);
    if (!result.isEmpty()) return res.status(400).json({ error: "Invalid request!" });
    const cleanData = matchedData(req);
    req.cleanData = cleanData;
    next();
}

// Export
module.exports = {
    checkAuth,
    generateRecoveryCodes,
    createLimiter,
    hotQueries,
    validateResult
};