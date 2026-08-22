const schemas = require("./schemas.js");
const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const { validationResult, matchedData } = require("express-validator");

// Check auth
async function checkAuth(req, res, next) {
    try {
        if (!req.session.isLoggedIn || !req.session.userId) return res.status(400).json({ error: "You are not logged in!" });
        const foundUser = await schemas.Users.findById(req.session.userId);
        if (!foundUser) return res.status(401).json({ error: "Can't find your account right now!" });
        if (foundUser.banned) return res.status(403).json({ error: "Your account is banned." });

        req.currentUser = foundUser;
        next();
    } catch (e) {
        console.log("Error:", e);
        return res.status(500).json({ error: "Something went wrong!" });
    }
}

// Generate recovery codes
async function generateRecoveryCodes(count = 3) {
    try {
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
    } catch (e) {
        console.log("Error:", e);
        return false;
    }
}

// Hot queries
const hotQueries = {
    modify_post: (postId, userId) => {
        return {
            by: userId,
            _id: postId,
            forkerId: null,
            receiverId: null
        }
    },

    view_post: (postId, userId) => {
        return {
            _id: postId,
            $or: [
                { by: userId, forkerId: null, receiverId: null },
                { forkerId: null, receiverId: null, private: false },
                {
                    $or: [
                        { forkerId: userId },
                        { receiverId: userId }
                    ]
                }
            ]
        }
    }
}

// Create limiter
function createLimiter(windowMs = 900000, limit = 1000, options = {}, error = "Too Many Requests. Please try again later.") {
    try {
        if (typeof options !== 'object' || options === null) return false;
        if (typeof error !== "string") return false;
        if (!Number.isInteger(limit) || !Number.isInteger(windowMs)) return false;

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
        return false;
    }
}

// Validate result
function validateResult(req, res, next) {
    try {
        const result = validationResult(req);
        if (!result.isEmpty()) return res.status(400).json({ error: "Invalid payload!" });
        const cleanData = matchedData(req);
        req.cleanData = cleanData;
        next();
    } catch (e) {
        console.log("Error:", e);
        return res.status(400).json({ error: "Something went wrong!" });
    }
}

// Export
module.exports = {
    checkAuth,
    generateRecoveryCodes,
    createLimiter,
    hotQueries,
    validateResult
};