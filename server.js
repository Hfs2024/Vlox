require("dotenv").config({
    quiet: true
});
const express = require("express");
const path = require("path");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const { checkAuth, createErrorMessage, checkValidID, generateRecoveryCodes, hotQueries } = require("./helpers.js");
const mongoose = require("mongoose");
const schemas = require("./schemas.js");
const MongoStore = require("connect-mongo");
const bookmarksRouter = require("./bookmarks.js").router;
const actionsRouter = require("./actions.js").router;
const authRouter = require("./auth.js").router;
const app = express();

// Connect MonogDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch(err => console.log(`Failed to connect MongoDB: ${err.message}`));

app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === "production";

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions',
        }),
        cookie: {
            httpOnly: true,
            secure: isProduction,
            maxAge: 3600000,
            sameSite: isProduction ? "none" : "lax"
        }
    })
);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.originalUrl.includes('/api/v1/reset/password')
});
app.use(limiter);
app.use("/", bookmarksRouter);
app.use("/", actionsRouter);
app.use("/", authRouter);

// Main route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Posts
app.post("/api/v1/posts", checkAuth, async (req, res) => {
    try {
        let { title, content, keywords, boost, spoilers } = req.body;
        title = String(title).trim();
        content = String(content).trim();
        keywords = keywords?.filter(Boolean)?.map(kw => kw.toLowerCase().trim()); // You give me a falsy value? Say goodbye to it.
        if (!title || !content) return res.status(400).json({ error: "Title and text content fields are strictly required" });
        if (title.length > 20 || content.length > req.currentUser.maxPostContentCharsLength) return res.status(400).json({
            error: `Title must be less than 20 chars and content cannnot exceed ${req.currentUser.maxPostContentCharsLength} chars`
        });

        const newPost = new schemas.Posts({
            title: title,
            content: content,
            by: req.session.userId,
            boosted: boost ? true : false,
            spoilers: spoilers ? true : false,
            keywords: (Array.isArray(keywords) && keywords.length <= 5) ? keywords : [],
            receiverId: null,
            forkerId: null,
            rootId: null
        });

        await newPost.save();
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error("Write Post Failure: ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to create post. Please try again." });
    }
});

app.post("/api/v1/get/post/comments/:id", checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const skip = parseInt(req.body.skip) || 0;
        const isPublic = await schemas.Posts.findOne(hotQueries.find_public_post(id, req.session.userId));
        if (!isPublic) return res.status(400).json({ error: "You don't have permissions to do this action." });
        const comments = await schemas.Comments.find({ for: id, rootId: null })
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .select("for content by")
            .populate("by", "-password -recoveryCodes -email -pinnedPostsCount")
            .lean();

        return res.status(200).json({ success: true, comments });
    } catch (e) {
        console.error("Fetch Comments Break: " + e.message);
        return res.status(500).json({ error: "Could not retrieve comments. Try again later." });
    }
});

app.post("/api/v1/get/post/replies/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const { rootId } = req.body;

        // Do you have permissions to access this post?
        const post = await schemas.Posts.find(hotQueries.find_user_post(id, req.session.userId));
        if (!post) return res.status(400).json({ error: "Post not found or you don't have permissions to see it!" });

        // Find replies
        const replies = await schemas.Comments.find({
            for: id,
            rootId: rootId
        })
            .populate("by", "-password -recoveryCodes -email -pinnedPostsCount");

        return res.status(200).json({ success: true, replies: replies });
    } catch (e) {
        console.error("Fetch Replies Break: ", e.message);
        return res.status(500).json({ error: "Could not retrieve replies." });
    }
});

app.get("/api/v1/get/post/:id", checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const foundPost = await schemas.Posts.findOne({
            ...hotQueries.find_public_post(id, req.session.userId),
            private: false
        }).populate("by", "-password -recoveryCodes -email -pinnedPostsCount")
            .populate("forkerId", "-password -recoveryCodes -email -pinnedPostsCount")
            .populate("receiverId", "-password -recoveryCodes -email -pinnedPostsCount");
        if (!foundPost) return res.status(400).json({ error: "Post not found!" });
        return res.status(200).json({ success: true, posts: [foundPost] });
    } catch (e) {
        console.error(`Failed To Get Post: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not get this post. Try again." });
    }
});

app.get("/api/v1/get/posts", async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const posts = await schemas.Posts.find({
            private: false,
            $or: [
                { forkerId: null, receiverId: null },
                { forkerId: req.session.userId },
                { receiverId: req.session.userId }
            ]
        }).sort({ boosted: -1, createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(50)
            .populate("by", "-password -recoveryCodes -email -pinnedPostsCount")
            .populate("forkerId", "-password -recoveryCodes -email -pinnedPostsCount")
            .populate("receiverId", "-password -recoveryCodes -email -pinnedPostsCount")
            .lean();

        return res.status(200).json({ success: true, posts });
    } catch (e) {
        console.error("Fetch Feed Break: ", e.message);
        return res.status(500).json({ error: "Could not retrieve feed index assets" });
    }
});

app.get("/api/v1/search/posts", async (req, res) => {
    try {
        const query = req.query.q.toLowerCase().trim();
        const foundPosts = await schemas.Posts.find({
            keywords: { $regex: query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), $options: "i" },
            private: false,
            forkerId: null,
            receiverId: null
        }).sort({
            likes: -1,
            createdAt: -1,
            _id: -1
        }).limit(100).populate("by", "-password -recoveryCodes -email -pinnedPostsCount");

        return res.status(200).json({ success: true, posts: foundPosts });
    } catch (e) {
        console.error("Search Posts Break: ", e.message);
        return res.status(500).json({ error: "Could not search posts. Try again later." });
    }
});

// Password recovery
const passwordRecoveryHourLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: {
        status: 429,
        error: 'Too Many Requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post("/api/v1/reset/password", passwordRecoveryHourLimit, async (req, res) => {
    try {
        const { username, recoveryCode, newPassword } = req.body;
        const foundUser = await schemas.Users.findOne({ username: username });
        if (!foundUser) return res.status(400).json({ error: "Failed to find user!" });
        if (newPassword.length < 6 || newPassword.length > 12) return res.status(400).json({ error: "Password must be between 6 and 12 chars!" });
        let foundOne = false;

        for (let code of foundUser.recoveryCodes) {
            const isValid = await bcrypt.compare(recoveryCode, code);

            if (isValid) {
                await schemas.Users.updateOne({
                    username: username,
                    recoveryCodes: code
                }, {
                    $set: {
                        password: await bcrypt.hash(newPassword, 10)
                    },

                    $pull: {
                        recoveryCodes: code
                    }
                });

                foundOne = true;
                break;
            }

            continue;
        }

        if (!foundOne) return res.status(400).json({ error: "Invalid recovery code!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Failed To Upadate User Password: ${e.message}`);
        return res.status(500).json({ error: "Could not update your password right now. Try again later." });
    }
});

app.post("/api/v1/reset/password/recovery-codes", passwordRecoveryHourLimit, checkAuth, async (req, res) => {
    try {
        const newCodes = await generateRecoveryCodes(3);
        const result = await schemas.Users.updateOne({
            _id: req.session.userId,
        }, {
            $set: {
                recoveryCodes: newCodes.hashed
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Could not find your account right now!" });
        return res.status(200).json({ success: true, codes: newCodes.raw });
    } catch (e) {
        console.error(`Failed To Revoke Recovery Codes: ${e.message}`);
        return res.status(500).json({ error: "Could not update your password right now. Try again later." });
    }
});

// Fallback
app.use((req, res) => {
    res.status(404).send("<h1>404 - Route not found.</h1>");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clean Engine live on port ${PORT}`);
});
