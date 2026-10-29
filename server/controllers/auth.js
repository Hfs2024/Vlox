import express from "express";
import bcrypt from "bcrypt";
import schemas from "../core/schemas.js";
import config from "../core/config.js";
import { checkAuth, generateRecoveryCodes, createLimiter } from "../core/utils.js";
import errors from "../../shared/errors.js";
import {
    updateUserBioValidator,
    loginValidator,
    signupValidator,
    updateUserVisibilityValidator,
    getUserProfileValidator,
    getUserPostsValidator
} from "../core/validators.js";

const router = express.Router();
const authRateLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.AUTH_RATE_LIMIT_MAX_REQ);

router.post("/users/login", authRateLimiter, loginValidator, async (req, res) => {
    const { username, password } = req.cleanData;

    const user = await schemas.Users.findOne({ username }).select("password");
    if (!user) return res.status(401).json({ error: errors.INVALID_CREDENTIALS() });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: errors.INVALID_CREDENTIALS() });

    req.session.isLoggedIn = true;
    req.session.userId = user._id;
    req.session.save((err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: errors.SESSION_INITIALIZATION_FAILED() });
        }

        return res.status(200).json({ success: true });
    });
});

router.post("/users/signup", authRateLimiter, signupValidator, async (req, res) => {
    const { username, password, email, bio } = req.cleanData;
    const recoveryCodes = await generateRecoveryCodes();
    const hashedPassword = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);

    const user = await schemas.Users.create({
        username,
        email,
        password: hashedPassword,
        bio,
        recoveryCodes: recoveryCodes.hashed
    });

    req.session.isLoggedIn = true;
    req.session.userId = user._id;
    req.session.save((err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: errors.SESSION_INITIALIZATION_FAILED() });
        }

        return res.status(201).json({ success: true, recoveryCodes: recoveryCodes.raw });
    });
});

router.get("/users/:id/profile", checkAuth, getUserProfileValidator, async function (req, res) {
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

    if (!user) return res.status(404).json({ error: errors.NOT_FOUND("User") });

    return res.status(200).json({ success: true, user });
});

router.get("/users/:id/posts", checkAuth, getUserPostsValidator, async function (req, res) {
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

    return res.status(200).json({ success: true, posts });
});

router.put("/me/visibility", checkAuth, updateUserVisibilityValidator, async (req, res) => {
    const value = req.cleanData.value;
    const now = new Date();

    const result = await schemas.Users.updateOne({
        _id: req.session.userId
    }, [
        {
            $set: {
                private: {
                    $cond: [{ $eq: ["$private", value] }, "$private", value]
                },

                updatedAt: {
                    $cond: [{ $eq: ["$private", value] }, "$updatedAt", now]
                }
            }
        }
    ], {
        timestamps: false
    });

    if (result.matchedCount === 0) return res.status(404).json({ error: errors.NOT_FOUND("Account") });

    return res.status(200).json({
        changed: result.modifiedCount !== 0,
        success: true
    });
});

router.put("/me/bio", checkAuth, updateUserBioValidator, async (req, res) => {
    const bio = req.cleanData.bio;
    const now = new Date();

    const result = await schemas.Users.updateOne({
        _id: req.session.userId
    }, [
        {
            $set: {
                bio: {
                    $cond: [{ $eq: ["$bio", bio] }, "$bio", bio]
                },
                updatedAt: {
                    $cond: [{ $eq: ["$bio", bio] }, "$updatedAt", now]
                }
            }
        }
    ], {
        timestamps: false
    });

    if (result.matchedCount === 0) return res.status(404).json({ error: errors.NOT_FOUND("Account") });

    return res.status(200).json({
        changed: result.modifiedCount !== 0,
        success: true
    });
});

router.delete("/me/signout", checkAuth, async (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: errors.SESSION_DESTROY_FAILED() });
        }

        res.clearCookie("connect.sid");
        return res.status(200).json({ success: true });
    });
});

router.get("/me/quick-info", checkAuth, async (req, res) => {
    return res.status(200).json({
        success: true,
        username: req.currentUser.username,
        _id: req.currentUser._id
    });
});

router.get("/me/status", async function (req, res) {
    return res.status(200).json({
        success: true,
        loggedIn: req.session.isLoggedIn
    });
});

export default router;