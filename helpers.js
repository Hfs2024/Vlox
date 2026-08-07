const schemas = require("./schemas.js");
const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

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

// Create error message
async function createErrorMessage(e, userId, errorRoute) {
    if (!mongoose.isValidObjectId(userId)) return console.log(`Failed to save error log: ${userId}`);
    const newCrash = new schemas.ErrorLogs({
        errorType: e.name,
        errorMessage: e.message,
        errorRoute: errorRoute,
        userId: userId,
        createdAt: new Date().toISOString()
    });

    await newCrash.save();
}

// Check valid ID
function checkValidID(req, res, next) {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: "This ID is not valid!" });
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
    };
}

// Hot queries
const hotQueries = {
    find_user_unforked_post: (postId, userId) => {
        return {
            by: userId,
            _id: postId,
            forkerId: null,
            receiverId: null
        }
    },

    find_user_post: (postId, userId) => {
        return {
            _id: postId,
            $or: [
                {
                    forkerId: null,
                    receiverId: null,
                    private: false
                },
                {
                    $or: [
                        { forkerId: userId },
                        { receiverId: userId }
                    ],
                    private: false
                }
            ]
        }
    },

    find_public_post: (postIds, userId) => {
        return {
            _id: postIds,
            $or: [
                { forkerId: null, receiverId: null, private: false },
                { forkerId: userId },
                { receiverId: userId },
                { by: userId, forkerId: null, receiverId: null }
            ]
        }
    }
}

// Export
module.exports = {
    checkAuth,
    createErrorMessage,
    checkValidID,
    generateRecoveryCodes,
    hotQueries
};