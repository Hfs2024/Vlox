import express from "express";
import bcrypt from "bcrypt";
import schemas from "./schemas.js";
import config from "./config/backend.js";
import { checkAuth, generateRecoveryCodes, createLimiter } from "./utils.js";
import {
    updateUserBioValidator,
    loginValidator,
    signupValidator,
    updateUserVisibilityValidator,
    getUserProfileValidator,
    getUserPostsValidator,
    resetPasswordValidator
} from "./validators.js";

const router = express.Router();
const passwordRecoveryLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.AUTH_RATE_LIMIT_MAX_REQ);
const authRateLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.AUTH_RATE_LIMIT_MAX_REQ);

router.post("/api/v1/users/login", authRateLimiter, loginValidator, async (req, res) => {
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

router.post("/api/v1/users/signup", authRateLimiter, signupValidator, async (req, res) => {
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

router.get("/api/v1/users/:id/profile", checkAuth, getUserProfileValidator, async function (req, res) {
    const id = req.cleanData.id;

    const user = await schemas.Users.findOne({
        _id: id,
        $or: [
            { _id: req.session.userId },
            { private: false }
        ]
    })
        .select("username bio private")
        .lean();

    if (!user) return res.status(400).json({ error: "User not found or their account is private!" });

    return res.status(200).json({ success: true, user: user });
});

router.get("/api/v1/users/:id/posts", checkAuth, getUserPostsValidator, async function (req, res) {
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

router.post("/api/v1/users/password", passwordRecoveryLimiter, resetPasswordValidator, async (req, res) => {
    const { username, recoveryCode, newPassword } = req.cleanData;
    const user = await schemas.Users.findOne({ username: username })
        .select("recoveryCodes")
        .lean();
    if (!user) return res.status(400).json({ error: "Failed to find user!" });

    for (const code of user.recoveryCodes) {
        const isValid = await bcrypt.compare(recoveryCode, code);
        if (!isValid) continue;

        const result = await schemas.Users.updateOne({
            username: username,
            recoveryCodes: code
        }, {
            $set: {
                password: await bcrypt.hash(newPassword, config.BCRYPT_SALT_ROUNDS)
            },
            $pull: {
                recoveryCodes: code
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Failed to update password!" });

        return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Invalid recovery code!" });
});

router.post("/api/v1/users/recovery-codes", passwordRecoveryLimiter, checkAuth, async (req, res) => {
    const newCodes = await generateRecoveryCodes();
    const result = await schemas.Users.updateOne({
        _id: req.session.userId,
    }, {
        $set: {
            recoveryCodes: newCodes.hashed
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Could not find your account right now!" });
    return res.status(200).json({ success: true, codes: newCodes.raw });
});

router.put("/api/v1/me/visibility", checkAuth, updateUserVisibilityValidator, async (req, res) => {
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

router.put("/api/v1/me/bio", checkAuth, updateUserBioValidator, async (req, res) => {
    const bio = req.cleanData.bio;
    const result = await schemas.Users.updateOne({
        _id: req.session.userId
    }, {
        $set: {
            bio: bio
        }
    }, {
        runValidators: true
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Failed to update!" });
    return res.status(200).json({ success: true });
});

router.delete("/api/v1/me/signout", checkAuth, async (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log("Error: " + err.message);
            return res.status(500).json({ error: "Server Error" });
        }

        res.clearCookie("connect.sid");
        return res.status(200).json({ success: true });
    });
});

router.get("/api/v1/me/quick-info", checkAuth, async (req, res) => {
    return res.status(200).json({
        success: true,
        username: req.currentUser.username,
        _id: req.currentUser._id
    });
});

router.get("/api/v1/me/status", async function (req, res) {
    return res.status(200).json({ success: true, loggedIn: req.session.isLoggedIn });
});

export default router;