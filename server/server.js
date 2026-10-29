import "express-async-errors";
import express from "express";
import path from "path";
import session from "express-session";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import config from "./core/config.js";
import errors from "../shared/errors.js";
import schemas from "./core/schemas.js";
import bookmarksRouter from "./controllers/bookmarks.js";
import postsRouter from "./controllers/posts.js";
import authRouter from "./controllers/auth.js";
import {
    checkAuth,
    createLimiter,
    postQueries
} from "./core/utils.js";
import {
    defaultPostFindValidator,
    getPostsValidator,
    createPostsValidator,
    getCommentsValidator
} from "./core/validators.js";

const __dirname = import.meta.dirname;
const app = express();

// MonogDB
mongoose.connect(config.MONGO_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch(err => console.error(err.message));

// Basic config
app.use(express.static(path.join(__dirname, "..", "client"), { index: false }));
app.use("/shared", express.static(path.join(__dirname, "..", "shared"), { index: false }));
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
            secure: config.PRODUCTION,
            maxAge: config.MAX_SESSION_AGE,
            sameSite: "lax"
        }
    })
)

const mainLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.MAIN_RATE_LIMIT_MAX_REQ, {
    skip: (req) => ["/api/v1/users/password", "/api/v1/users/recovery-codes"].some((path) => req.originalUrl.includes(path))
});

app.use(mainLimiter);

// Sub routes
app.use("/api/v1", bookmarksRouter);
app.use("/api/v1", postsRouter);
app.use("/api/v1", authRouter);

// Main routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

// Basic routes
app.post("/api/v1/posts", checkAuth, createPostsValidator, async (req, res) => {
    const { title, content } = req.cleanData;
    const newPost = new schemas.Posts({
        title,
        content,
        by: req.session.userId
    });

    await newPost.save();
    return res.status(201).json({ success: true, postId: newPost._id });
});

app.get("/api/v1/posts/:id", checkAuth, defaultPostFindValidator, async (req, res) => {
    const id = req.cleanData.id;
    const post = await schemas.Posts.findOne({
        ...postQueries.view_post(id, req.session.userId)
    })
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    if (!post) return res.status(404).json({ error: errors.POST_NOT_FOUND });
    return res.status(200).json({ success: true, posts: [post] });
});

app.get("/api/v1/posts", getPostsValidator, async (req, res) => {
    const skip = req.cleanData.skip;

    // Find posts
    const posts = await schemas.Posts.find({
        private: false
    })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(config.POSTS_LIMIT)
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, posts });
});

app.get("/api/v1/posts/:id/comments", checkAuth, getCommentsValidator, async (req, res) => {
    const { skip, id } = req.cleanData;
    const comments = await schemas.Comments.find({ for: id })
        .skip(skip)
        .limit(config.COMMENTS_LIMIT)
        .sort({ createdAt: -1, _id: -1 })
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, comments });
});

app.use((req, res) => {
    res.status(404).send("<h1>404 - Route not found.</h1>");
});

app.use((err, req, res, next) => {
    if (err.code === 11000) return res.status(409).json({ error: errors.DUPLICATE_RESOURCE });
    if (err.isCustom) return res.status(err.statusCode).json({ error: err.message });

    // For debugging only
    console.error(err);
    return res.status(500).json({ error: errors.UNEXPECTED_ERROR });
});

app.listen(config.PORT, config.HOST, () => {
    console.log(`Clean Engine live on port ${config.PORT}`);
});