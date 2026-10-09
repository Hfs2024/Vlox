import "express-async-errors";
import express from "express";
import path from "path";
import session from "express-session";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import schemas from "./schemas.js";
import bookmarksRouter from "./bookmarks.js";
import actionsRouter from "./actions.js";
import authRouter from "./auth.js";
import config from "./config/backend.js";
import {
    checkAuth,
    generateRecoveryCodes,
    createLimiter,
    postQueries
} from "./utils.js";
import {
    defaultPostFindValidator,
    getPostsValidator,
    createPostsValidator,
    resetPasswordValidator
} from "./validators.js";

const __dirname = import.meta.dirname;
const isProduction = config.NODE_ENV === "production";
const app = express();

// Connect MonogDB
mongoose.connect(config.MONGO_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch(err => console.log(`Failed to connect MongoDB: ${err.message}`));

// Basic config
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.get("/config/shared.js", (req, res) => {
    res.sendFile(path.join(__dirname, "config", "shared.js"));
});
app.use(express.json({ limit: config.JSON_BODY_LIMIT }));
app.use(
    session({
        secret: config.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: config.MONGO_URI,
            collectionName: "sessions"
        }),
        cookie: {
            httpOnly: true,
            secure: isProduction,
            maxAge: config.MAX_SESSION_AGE,
            sameSite: isProduction ? "none" : "lax"
        }
    })
);
const mainLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.MAIN_RATE_LIMIT_MAX_REQ, {
    skip: (req) => ["/api/v1/users/password", "/api/v1/users/recovery-codes"].some((path) => req.originalUrl.includes(path))
});

app.use(mainLimiter);

// Sub routes
app.use("/", bookmarksRouter);
app.use("/", actionsRouter);
app.use("/", authRouter);

// Main routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Posts
app.post("/api/v1/posts", checkAuth, createPostsValidator, async (req, res) => {
    const { title, content, keywords } = req.cleanData;
    const newPost = new schemas.Posts({
        title: title,
        content: content,
        by: req.session.userId,
        keywords: keywords
    });

    await newPost.save();
    return res.status(200).json({ success: true });
});

app.get("/api/v1/posts/:id", defaultPostFindValidator, async (req, res) => {
    const id = req.cleanData.id;
    const post = await schemas.Posts.findOne({
        ...postQueries.view_post(id, req.session.userId)
    })
        .select("-reports")
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    if (!post) return res.status(400).json({ error: "Post not found!" });
    return res.status(200).json({ success: true, posts: [post] });
});

app.get("/api/v1/posts", getPostsValidator, async (req, res) => {
    const { skip, chronological } = req.cleanData;

    // Sort query
    const sortQuery = chronological
        ? { createdAt: -1, _id: -1 }
        : { likes: -1, createdAt: -1, _id: -1 };

    // Find posts
    const posts = await schemas.Posts.find({
        private: false
    })
        .sort(sortQuery)
        .skip(skip)
        .limit(config.POSTS_LIMIT)
        .select("-reports")
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, posts });
});

// Password recovery
const passwordRecoveryLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.AUTH_RATE_LIMIT_MAX_REQ);

app.post("/api/v1/users/password", passwordRecoveryLimiter, resetPasswordValidator, async (req, res) => {
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

app.post("/api/v1/users/recovery-codes", passwordRecoveryLimiter, checkAuth, async (req, res) => {
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

app.use((req, res) => {
    res.status(404).send("<h1>404 - Route not found.</h1>");
});

app.use((err, req, res, next) => {
    if (err.code === 11000) return res.status(400).json({ error: "You've already done this action!" });
    if (err.isCustom) return res.status(err.statusCode).json({ error: err.message });

    // For debugging only
    console.log(err);
    return res.status(500).json({ error: "An unexpected error occurred!" });
});

app.listen(config.PORT, config.HOST, () => {
    console.log(`Clean Engine live on port ${config.PORT}`);
});