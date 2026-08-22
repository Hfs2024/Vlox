require("dotenv").config({
    quiet: true
});
const express = require("express");
const path = require("path");
const session = require("express-session");
const { body, param, query } = require("express-validator");
const bcrypt = require("bcrypt");
const { checkAuth, validateResult, generateRecoveryCodes, createLimiter, hotQueries } = require("./helpers.js");
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

// Basic config
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use(express.json({ limit: "10mb" }));
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
const limiter = createLimiter(900000, 1000, {
    skip: (req) => req.originalUrl.includes('/api/v1/reset/password')
});
if (!limiter) console.log("Failed to create main limit!");
else app.use(limiter);

// Sub routes
app.use("/", bookmarksRouter);
app.use("/", actionsRouter);
app.use("/", authRouter);

// Main route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Posts
app.post("/api/v1/posts", checkAuth, [
    body("title").notEmpty().isString().isLength({ max: 20 }).trim(),
    body("content").notEmpty().isString().custom((value, { req }) => {
        if (value?.length > req.currentUser.maxPostContentCharsLength) return false;
        return true;
    }).trim(),
    body("spoilers").exists().isIn([true, false]),
    body("keywords").exists().isArray({ max: 5 }).customSanitizer(value => value?.filter(Boolean)?.map(kw => kw.toLowerCase().trim()))
], validateResult, async (req, res) => {
    try {
        const { title, content, spoilers, keywords } = req.cleanData;
        const newPost = new schemas.Posts({
            title: title,
            content: content,
            by: req.session.userId,
            boosted: title.toUpperCase() === "[BOOST]",
            spoilers: spoilers,
            keywords: keywords,
            receiverId: null,
            forkerId: null,
            rootId: null
        });

        await newPost.save();
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error("Write Post Failure: ", e.message);
        return res.status(500).json({ error: "Failed to create post. Please try again." });
    }
});

// Insert many posts
const bulkPostsLimit = createLimiter(3600000, 3);
if (!bulkPostsLimit) console.log("Failed to create bulk posts limit!");
app.post("/api/v1/posts/bulk", checkAuth, [
    body("posts").exists().isArray({ max: 10 })
], bulkPostsLimit, validateResult, async (req, res) => {
    try {
        const { posts } = req.cleanData;
        // Clean those posts
        for (let i = 0; i < posts.length; i++) {
            posts[i] = {
                by: req.session.userId,
                content: posts[i].content,
                title: posts[i].title,
                keywords: (Array.isArray(posts[i]?.keywords) && posts[i]?.keywords?.length <= 5) ? posts[i]?.keywords : [],
                boosted: posts[i]?.title?.toUpperCase()?.trim() === "[BOOST]",
                spoilers: posts[i].spoilers ? true : false,
                private: posts[i].private ? true : false,
                pinned: posts[i].pinned ? true : false
            }
        }

        // It's time to insert them
        await schemas.Posts.insertMany(posts, { ordered: false });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Failed To Insert Posts: ${e.message}`);
        return res.status(500).json({ error: "Could not insert posts. Try again later." });
    }
});

app.get("/api/v1/get/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    try {
        const id = req.cleanData.id;
        const foundPost = await schemas.Posts.findOne({
            ...hotQueries.view_post(id, req.session.userId)
        }).populate("by", "-password -recoveryCodes -email -pinnedPostsCount")
            .populate("forkerId", "-password -recoveryCodes -email -pinnedPostsCount")
            .populate("receiverId", "-password -recoveryCodes -email -pinnedPostsCount");
        if (!foundPost) return res.status(400).json({ error: "Post not found!" });
        return res.status(200).json({ success: true, posts: [foundPost] });
    } catch (e) {
        console.error(`Failed To Get Post: ${e.message}. User ID: ${req.session.userId}`);
        return res.status(500).json({ error: "Could not get this post. Try again." });
    }
});

app.get("/api/v1/get/posts", [
    query("skip").exists().isInt({ min: 0 })
], validateResult, async (req, res) => {
    try {
        const skip = req.cleanData.skip;
        const posts = await schemas.Posts.find({
            private: false,
            $or: [
                { forkerId: null, receiverId: null },
                { forkerId: req.session.userId },
                { receiverId: req.session.userId }
            ]
        }).sort({ boosted: -1, createdAt: -1, _id: -1 })
            .skip(parseInt(skip))
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

app.get("/api/v1/search/posts", [
    query("q").exists().notEmpty().isString().isLength({ max: 100 }).customSanitizer(value => value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).toLowerCase().trim()
], validateResult, async (req, res) => {
    try {
        const query = req.cleanData.q;
        const foundPosts = await schemas.Posts.find({
            keywords: { $regex: query, $options: "i" },
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

app.get("/api/v1/get/post/comments/:id", checkAuth, [
    param("id").exists().isMongoId(),
    query("skip").exists().isInt({ min: 0 })
], validateResult, async (req, res) => {
    try {
        const { skip, id } = req.cleanData;
        const isPublic = await schemas.Posts.findOne(hotQueries.view_post(id, req.session.userId));
        if (!isPublic) return res.status(400).json({ error: "Post not found!" });
        const comments = await schemas.Comments.find({ for: id, rootId: null })
            .sort({ createdAt: -1, _id: -1 })
            .skip(parseInt(skip))
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

app.get("/api/v1/get/post/replies/:id/:rootId", checkAuth, [
    param("id").exists().isMongoId(),
    param("rootId").exists().isMongoId()
], validateResult, async (req, res) => {
    try {
        const { id, rootId } = req.cleanData;

        // Do you have permissions to access this post?
        const post = await schemas.Posts.find(hotQueries.view_post(id, req.session.userId));
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

// Password recovery
const passwordRecoveryLimit = createLimiter(3600000, 5);
if (!passwordRecoveryLimit) console.log("Failed to create passwored recovery limit!");
app.post("/api/v1/reset/password", [
    body("username").exists().notEmpty().isLength({ min: 3, max: 10 }).toLowerCase().trim(),
    body("newPassword").exists().notEmpty().isLength({ min: 6, max: 12 }).trim(),
    body("recoveryCode").exists().notEmpty()
], passwordRecoveryLimit, validateResult, async (req, res) => {
    try {
        const { username, recoveryCode, newPassword } = req.cleanData;
        const user = await schemas.Users.findOne({ username: username });
        if (!user) return res.status(400).json({ error: "Failed to find user!" });
        let foundOne = false;

        for (let code of user.recoveryCodes) {
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

app.post("/api/v1/reset/password/recovery-codes", passwordRecoveryLimit, checkAuth, async (req, res) => {
    try {
        const newCodes = await generateRecoveryCodes(3);
        if (!newCodes) return res.status(400).json({ error: "Failed to generate new codes!" });
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
