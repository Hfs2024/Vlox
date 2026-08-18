const schemas = require("./schemas.js");
const bcrypt = require("bcrypt");
const { checkAuth, createErrorMessage, checkValidID, generateRecoveryCodes } = require("./helpers.js");
const express = require("express");
const router = express.Router();

// Private posts
router.post("/api/v1/get/user-private-posts", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
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

// Login and signup
router.post("/api/v1/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (req.session.isLoggedIn === true) return res.status(400).json({ error: "You are already logged in!" });
        if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
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

router.post("/api/v1/signup", async (req, res) => {
    try {
        let { username, password, email, bio } = req.body;
        if (req.session.isLoggedIn) return res.status(400).json({ error: "You are already logged in!" });
        username = String(username).trim();
        password = String(password).trim();
        email = String(email).trim();
        bio = String(bio).trim();
        if (!username || !password || !email) return res.status(400).json({ error: "Username, email, and password are required" });
        if (username.length < 3 || username.length > 10) return res.status(400).json({ error: "Username must be between 3 and 10 chars." });
        if (password.length < 6 || password.length > 12) return res.status(400).json({ error: "Password must be between 6 and 12 chars." });
        if (bio && bio.length > 20) return res.status(400).json({ error: "Bio must be less than 20 chars" });

        const existingUser = await schemas.Users.findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });
        if (existingUser) return res.status(400).json({ error: "Username already exists" });

        const recoveryCodes = await generateRecoveryCodes();
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new schemas.Users({
            username: username,
            email: req.body.email.toLowerCase().trim(),
            password: hashedPassword,
            bio: bio || "",
            recoveryCodes: recoveryCodes.hashed
        });

        await newUser.save();

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
        console.error("Signup Failure: ", e.message);
        return res.status(500).json({ error: "Failed to create new user. Try again." });
    }
});

// Update user
router.put("/api/v1/update/user", checkAuth, async (req, res) => {
    try {
        let { newBio, newEmail, newEmoji } = req.body;
        const updateQuery = {};
        if (newEmoji) updateQuery.emoji = newEmoji ? newEmoji.normalize("NFC") : null;
        if (newEmail) updateQuery.email = newEmail;
        if (newBio) {
            newBio = String(newBio).trim();
            if (newBio.length > 20) return res.status(400).json({ error: "Bio should be less than 20 chars!" });
            updateQuery.bio = newBio;
        }

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
        createErrorMessage(e, req.session.userId, req.originalUrl);
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
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to signout. Try again." });
    }
});

// User quick info
router.get("/api/v1/get/current-user-quick-info", checkAuth, async (req, res) => {
    try {
        return res.status(200).json({ success: true, username: req.currentUser.username, emoji: req.currentUser.emoji, bio: req.currentUser.bio, maxPostContentCharsLength: req.currentUser.maxPostContentCharsLength });
    } catch (e) {
        console.error(`Failed To Get Username: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not get your quick info. Try again." });
    }
});

// User's profile
router.get("/api/v1/get/user-profile/:name", checkAuth, async function (req, res) {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const user = await schemas.Users.findOne({ username: req.params.name, private: false });
        if (!user) return res.status(400).json({ error: "User not found or their account is private!" });
        const foundPosts = await schemas.Posts.find({
            by: user._id,
            private: false,
            forkerId: null,
            receiverId: null
        }).sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .populate("by", "-password -recoveryCodes -email")
            .lean();

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
            email: user.email
        });
    } catch (e) {
        console.error(`Failed To Get User: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not find your account right now" });
    }
});

router.get("/api/v1/get/user-profile", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const foundPosts = await schemas.Posts.find({
            by: req.session.userId,
            forkerId: null,
            receiverId: null
        }).sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .populate("by", "-password -recoveryCodes -email")
            .lean();

        const foundPinnedPosts = await schemas.Posts.find({
            by: req.session.userId,
            pinned: true // Pinned!
        }).sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .populate("by", "-password -recoveryCodes -email")
            .lean();

        return res.status(200).json({
            success: true,
            posts: foundPosts,
            username: req.currentUser.username,
            emoji: req.currentUser.emoji,
            bio: req.currentUser.bio,
            private: req.currentUser.private,
            pinnedPosts: foundPinnedPosts,
            email: req.currentUser.email
        });
    } catch (e) {
        console.error(`Failed To Get User: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
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