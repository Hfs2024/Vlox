const schemas = require("./schemas.js");
const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const he = require("he");

function cleanData(data) {
    if (typeof data === "string") return he.encode(data).trim();
    if (Array.isArray(data)) return data.map((item) => cleanData(item));
    if (data !== null && typeof data === "object") {
        const cleanedObject = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                cleanedObject[key] = cleanData(data[key]);
            }
        }
        return cleanedObject;
    }
    return data;
}

// Check auth
async function checkAuth(req, res, next) {
    try {
        if (!req.session.isLoggedIn || !req.session.userId) {
            return res.status(401).json({ error: "You are not logged in!" });
        }

        const foundUser = await schemas.Users.findById(req.session.userId);
        if (!foundUser) {
            return res.status(401).json({ error: "Can't find your account right now!" });
        }
        if (foundUser.banned) {
            return res.status(403).json({ error: "Your account is banned.", banned: true });
        }

        req.currentUser = foundUser;
        next();
    } catch (err) {
        return res.status(500).json({ error: "Error:" + err.message });
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
async function checkValidID(req, res, next) {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "This ID is not valid!" });
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

module.exports = { checkAuth, createErrorMessage, checkValidID, cleanData, generateRecoveryCodes };