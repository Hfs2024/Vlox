const schemas = require("./schemas.js");
const bcrypt = require("bcrypt");
const { body, param, query } = require("express-validator");
const { checkAuth, generateRecoveryCodes, validateResult } = require("./helpers.js");
const express = require("express");
const router = express.Router();

// Private posts
router.post("/api/v1/get/user-private-posts", checkAuth, [
    query("skip").exists().isInt({ min: 0 })
], validateResult, async (req, res) => {
    try {
        const skip = parseInt(req.cleanData.skip);
        const foundPosts = await schemas.Posts.find({
            by: req.session.userId,
            private: true,
            forkerId: null,
            receiverId: null
        })
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .lean();

        return res.json({ success: true, posts: foundPosts });
    } catch (e) {
        console.error("Fetch Private Posts Break: ", e.message);
        return res.status(500).json({ error: "Could not retrieve your private posts" });
    }
});

// Change profile visibility
router.put("/api/v1/change-visibility/user-profile", checkAuth, [
    body("value").exists().isIn([true, false])
], validateResult, async (req, res) => {
    try {
        const value = req.cleanData.value;
        const result = await schemas.Users.updateOne({
            _id: req.session.userId,
            private: value ? false : true
        }, {
            $set: {
                private: value
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Something went wrong. Try again." });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to change visibility. Try again." });
    }
});

// Login and signup
router.post("/api/v1/login", [
    body("username").exists().notEmpty().isString().isLength({ min: 3, max: 10 }),
    body("password").exists().notEmpty().isString().isLength({ min: 6, max: 12 })
], validateResult, async (req, res) => {
    try {
        const { username, password } = req.cleanData;
        const user = await schemas.Users.findOne({ username: username });
        if (!user) return res.status(400).json({ error: "Invalid username or password" });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid username or password" });

        req.session.isLoggedIn = true;
        req.session.userId = user._id;
        req.session.save((err) => {
            if (err) {
                console.error("Login Session Save Failure: ", err.message);
                return res.status(500).json({ error: "Session initialization failed" });
            }
            return res.status(200).json({ success: true });
        });
    } catch (e) {
        console.error("Login Failure: ", e.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/api/v1/signup", [
    body("username").exists().notEmpty().isString().isLength({ min: 3, max: 10 }).toLowerCase().trim(),
    body("password").exists().notEmpty().isString().isLength({ min: 6, max: 12 }).trim(),
    body("bio").exists().notEmpty().isString().isLength({ min: 5, max: 20 }).trim(),
    body("email").exists().notEmpty().isEmail().isLength({ max: 100 }).normalizeEmail().trim()
], validateResult, async (req, res) => {
    try {
        const { username, password, email, bio } = req.cleanData;

        // Save user
        const recoveryCodes = await generateRecoveryCodes();
        if (!recoveryCodes) return res.status(400).json({ error: "Failed to generate recovery codes!" });
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new schemas.Users({
            username: username,
            email: email,
            password: hashedPassword,
            bio: bio || "",
            recoveryCodes: recoveryCodes.hashed
        });

        await newUser.save();

        // Success
        req.session.isLoggedIn = true;
        req.session.userId = newUser._id;
        req.session.save((err) => {
            if (err) {
                console.error("Signup Session Save Failure: ", err.message);
                return res.status(500).json({ error: "Session creation failed" });
            }
            return res.status(201).json({ success: true, recoveryCodes: recoveryCodes.raw });
        });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: "User already exists!" });
        console.error("Signup Failure: ", e.message);
        return res.status(500).json({ error: "Failed to create new user. Try again." });
    }
});

// Update user
router.put("/api/v1/update/user", checkAuth, [
    body("newEmoji").optional({ values: "falsy" }).isString().isIn(["🚀", "👦🏻", "👧🏻", "🏇🏻"]).trim(),
    body("newEmail").optional({ values: "falsy" }).isEmail().isLength({ max: 100 }).normalizeEmail().trim(),
    body("newBio").optional({ values: "falsy" }).isString().isLength({ max: 20 }).trim()
], validateResult, async (req, res) => {
    try {
        let { newBio, newEmail, newEmoji } = req.cleanData;
        const updateQuery = {};
        if (newEmoji) updateQuery.emoji = newEmoji.normalize("NFC");
        if (newEmail) updateQuery.email = newEmail;
        if (newBio) updateQuery.bio = newBio;

        // Update
        const result = await schemas.Users.updateOne({
            _id: req.session.userId
        }, {
            $set: updateQuery
        }, {
            runValidators: true
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Can't find your account right now!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`User Update Failure: ${e.message}. User ID: ${req.session.userId}`);
        return res.status(500).json({ error: "Failed to update. Try again." });
    }
});

// Signout
router.delete("/api/v1/signout", checkAuth, async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error: " + err.message);
                return res.status(500).json({ error: "Server Error" });
            }

            res.clearCookie('connect.sid');
            return res.status(200).json({ success: true });
        });
    } catch (e) {
        console.error("Signout Failure: ", e.message);
        return res.status(500).json({ error: "Failed to signout. Try again." });
    }
});

// User quick info
router.get("/api/v1/get/current-user-quick-info", checkAuth, async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            username: req.currentUser.username,
            emoji: req.currentUser.emoji,
            bio: req.currentUser.bio,
            maxPostContentCharsLength: req.currentUser.maxPostContentCharsLength,
            _id: req.currentUser._id
        });
    } catch (e) {
        console.error(`Failed To Get Username: ${e.message}. User ID: ${req.session.userId}`);
        return res.status(500).json({ error: "Could not get your quick info. Try again." });
    }
});

// Profiles
router.get("/api/v1/get/user-profile/:id", checkAuth, [
    query("skip").exists().isInt({ min: 0 }),
    param("id").exists().isMongoId()
], validateResult, async function (req, res) {
    try {
        const skip = parseInt(req.cleanData.skip);
        const id = req.cleanData.id;
        // User
        const user = await schemas.Users.findOne({
            _id: id,
            $or: [
                { _id: req.session.userId },
                { private: false }
            ]
        });
        if (!user) return res.status(400).json({ error: "User not found or their account is private!" });

        // Public posts
        const foundPosts = await schemas.Posts.find({
            by: user._id,
            forkerId: null,
            receiverId: null,
            $or: [
                { by: req.session.userId },
                { private: false }
            ]
        }).sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .populate("by", "-password -recoveryCodes -email")
            .lean();

        // Pinned posts
        const foundPinnedPosts = await schemas.Posts.find({
            by: user._id,
            pinned: true // Pinned!
        }).sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .populate("by", "-password -recoveryCodes -email")
            .lean();

        return res.status(200).json({
            success: true,
            posts: foundPosts,
            username: user.username,
            emoji: user.emoji,
            pinnedPosts: foundPinnedPosts,
            bio: user.bio,
            email: user.email,
            private: user.private
        });
    } catch (e) {
        console.error(`Failed To Get User: ${e.message}. User ID: ${req.session.userId}`);
        return res.status(500).json({ error: "Could not find your account right now" });
    }
});

// User status
router.get("/api/v1/get/user-status", async function (req, res) {
    try {
        return res.status(200).json({ success: true, loggedIn: req.session.isLoggedIn });
    } catch (e) {
        console.error(`Failed To Get User Status: ${e.message}. User ID: ${req.session.userId} `);
        return res.status(500).json({ error: "Could not find your status right now" });
    }
});

module.exports = {
    router
}