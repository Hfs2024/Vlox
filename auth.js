import express from "express";
import bcrypt from "bcrypt";
import { checkAuth, generateRecoveryCodes, createLimiter } from "./utils.js";
import schemas from "./schemas.js";
import config from "./config/backend.js";
import {
    changeUserVisibilityValidator,
    loginValidator,
    signupValidator,
    updateUserValidator,
    getUserProfileValidator,
    getUserPostsValidator
} from "./validators.js";
const router = express.Router();

router.put("/api/v1/change-visibility/user-profile", checkAuth, changeUserVisibilityValidator, async (req, res) => {
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
});

const authRateLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.AUTH_RATE_LIMIT_MAX_REQ);

router.post("/api/v1/login", authRateLimiter, loginValidator, async (req, res) => {
    const { username, password } = req.cleanData;

    const user = await schemas.Users.findOne({ username: username }).select("password");
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
});

router.post("/api/v1/signup", authRateLimiter, signupValidator, async (req, res) => {
    const { username, password, email, bio } = req.cleanData;
    const recoveryCodes = await generateRecoveryCodes();
    const hashedPassword = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);

    const newUser = new schemas.Users({
        username: username,
        email: email,
        password: hashedPassword,
        bio: bio,
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
});

router.put("/api/v1/update/user", checkAuth, updateUserValidator, async (req, res) => {
    const { newBio, newEmoji } = req.cleanData;
    const updateQuery = {};
    if (newEmoji) updateQuery.emoji = newEmoji.normalize("NFC");
    if (newBio) updateQuery.bio = newBio;

    const result = await schemas.Users.updateOne({
        _id: req.session.userId
    }, {
        $set: updateQuery
    }, {
        runValidators: true
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Failed to update!" });
    return res.status(200).json({ success: true });
});

router.delete("/api/v1/signout", checkAuth, async (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log("Error: " + err.message);
            return res.status(500).json({ error: "Server Error" });
        }

        res.clearCookie("connect.sid");
        return res.status(200).json({ success: true });
    });
});

router.get("/api/v1/get/user-quick-info", checkAuth, async (req, res) => {
    return res.status(200).json({
        success: true,
        username: req.currentUser.username,
        _id: req.currentUser._id,
        coins: req.currentUser.coins,
    });
});

router.get("/api/v1/get/user-profile/:id", checkAuth, getUserProfileValidator, async function (req, res) {
    const id = req.cleanData.id;

    const user = await schemas.Users.findOne({
        _id: id,
        $or: [
            { _id: req.session.userId },
            { private: false }
        ]
    })
        .select("username emoji bio private coins")
        .lean();

    if (!user) return res.status(400).json({ error: "User not found or their account is private!" });
    
    return res.status(200).json({ success: true, user: user });
});

router.get("/api/v1/get/user-posts/:id", checkAuth, getUserPostsValidator, async function (req, res) {
    const { id, skip } = req.cleanData;
    const posts = await schemas.Posts.find({
        by: id,
        $or: [
            { by: req.session.userId },
            { private: false }
        ]
    }).sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(config.USER_POSTS_LIMIT)
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.json({ success: true, posts: posts });
});

router.get("/api/v1/get/user-status", async function (req, res) {
    return res.status(200).json({ success: true, loggedIn: req.session.isLoggedIn });
});

export default router;