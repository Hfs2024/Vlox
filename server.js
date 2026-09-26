require("dotenv").config({ quiet: true });
require("express-async-errors");
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
const mainLimiter = createLimiter(900000, 1000, {
    skip: (req) => ['/api/v1/reset/password', '/api/v1/posts/bulk'].some(path => req.originalUrl.includes(path))
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
app.post("/api/v1/posts", checkAuth, [
    body("title").notEmpty().isString().isLength({ max: 20 }).trim(),
    body("content").notEmpty().isString().custom((value, { req }) => {
        const maxPostsLength = req.currentUser.maxPostsLength || 2000;
        if (value.length > maxPostsLength) return false;
        return true;
    }).trim(),
    body("keywords").exists().isArray({ max: 5 }).customSanitizer(value => value.filter(Boolean).map(kw => kw.toLowerCase().trim()))
], validateResult, async (req, res) => {
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

app.get("/api/v1/get/post/:id", [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const id = req.cleanData.id;
    const post = await schemas.Posts.findOne({
        ...hotQueries.view_post(id, req.session.userId)
    })
        .select("-reports")
        .populate("by", "-password -recoveryCodes -email")
        .lean();
    if (!post) return res.status(400).json({ error: "Post not found!" });

    return res.status(200).json({ success: true, posts: [post] });
});

app.get("/api/v1/get/posts", [
    query("skip").exists().isInt({ min: 0 })
], validateResult, async (req, res) => {
    const skip = req.cleanData.skip;
    const posts = await schemas.Posts.find({
        private: false
    }).sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(50)
        .select("-reports")
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, posts });
});

app.get("/api/v1/search/posts", [
    query("query").exists().notEmpty().isString().isLength({ max: 100 }).customSanitizer(value => value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).toLowerCase().trim()
], validateResult, async (req, res) => {
    const query = req.cleanData.query;
    const posts = await schemas.Posts.find({
        keywords: query,
        private: false
    }).sort({
        likes: -1,
        createdAt: -1,
        _id: -1
    }).limit(100).populate("by", "-password -recoveryCodes -email").lean();

    return res.status(200).json({ success: true, posts: posts });
});

app.get("/api/v1/get/post/comments/:id", checkAuth, [
    param("id").exists().isMongoId(),
    query("skip").exists().isInt({ min: 0 })
], validateResult, async (req, res) => {
    const { skip, id } = req.cleanData;

    // Check permissions to see post 
    const post = await schemas.Posts.exists(hotQueries.view_post(id, req.session.userId));
    if (!post) return res.status(400).json({ error: "Post not found!" });

    // Find comments
    const comments = await schemas.Comments.find({ for: id, parentCommentId: null })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(10)
        .select("for content by")
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, comments });
});

app.get("/api/v1/get/post/:postId/replies/:parentCommentId", checkAuth, [
    param("postId").exists().isMongoId(),
    param("parentCommentId").exists().isMongoId()
], validateResult, async (req, res) => {
    const { postId, parentCommentId } = req.cleanData;

    // Check permissions to see post
    const post = await schemas.Posts.find(hotQueries.view_post(postId, req.session.userId));
    if (!post) return res.status(400).json({ error: "Post not found or you don't have permissions to see it!" });

    // Find replies
    const replies = await schemas.Comments.find({
        for: postId,
        parentCommentId: parentCommentId
    })
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, replies: replies });
});

// Password recovery
const passwordRecoveryLimiter = createLimiter(3600000, 5);

app.post("/api/v1/reset/password", [
    body("username").exists().notEmpty().isString().isLength({ min: 3, max: 10 }).toLowerCase().trim(),
    body("newPassword").exists().notEmpty().isString().isLength({ min: 12, max: 64 }).trim(),
    body("recoveryCode").exists().notEmpty().isString().isLength({ min: 20, max: 20 }).trim()
], passwordRecoveryLimiter, validateResult, async (req, res) => {
    const { username, recoveryCode, newPassword } = req.cleanData;
    const user = await schemas.Users.findOne({ username: username });
    if (!user) return res.status(400).json({ error: "Failed to find user!" });
    let foundOne = false;

    for (let code of user.recoveryCodes) {
        const isValid = await bcrypt.compare(recoveryCode, code);
        if (!isValid) continue;

        // Update
        const result = await schemas.Users.updateOne({
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

        if (result.matchedCount === 0) return res.status(400).json({ error: "Failed to update password!" });

        // Success
        foundOne = true;
        break;
    }

    if (!foundOne) return res.status(400).json({ error: "Invalid recovery code!" });
    return res.status(200).json({ success: true });
});

app.post("/api/v1/reset/password/recovery-codes", passwordRecoveryLimiter, checkAuth, async (req, res) => {
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
});

// Gifts
app.post("/api/v1/redeem/gift-link/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const id = req.cleanData.id;
    const remaining = Math.max(0, 4000 - req.currentUser.maxPostsLength);
    const inc = Math.min(100, remaining);
    if (inc <= 0) return res.status(400).json({ error: "Gift redeem failed!" });

    // Redeem the gift
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
        // Gift
        const giftResult = await schemas.Gifts.updateOne(
            { _id: id, status: "active", usedBy: { $ne: req.session.userId } },
            [
                {
                    $set: {
                        status: {
                            $cond: {
                                if: { $eq: [{ $subtract: ["$usesCount", "$usedCount"] }, 1] },
                                then: "expired",
                                else: "$status"
                            }
                        },
                        usedCount: {
                            $cond: {
                                if: { $eq: ["$usedCount", "$usesCount"] },
                                then: "$usedCount",
                                else: { $add: ["$usedCount", 1] }
                            }
                        },
                        usedBy: {
                            $setUnion: [
                                { $ifNull: ["$usedBy", []] },
                                [new mongoose.Types.ObjectId(req.session.userId)]
                            ]
                        }
                    }
                }
            ],
            { session }
        );
        if (giftResult.matchedCount === 0) throw new Error("GIFT_REDEEM_FAILED");

        // User
        const userResult = await schemas.Users.updateOne({
            _id: req.session.userId,
            maxPostsLength: { $lt: 4000 }
        }, {
            $inc: {
                maxPostsLength: inc
            }
        }, { session });
        if (userResult.matchedCount === 0) throw new Error("USER_UPDATE_FAILED");
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

app.get("/api/v1/get/gifts", checkAuth, async (req, res) => {
    const gifts = await schemas.Gifts.find({ status: "active" });
    return res.status(200).json({ success: true, gifts });
});

// Fallback
app.use((req, res) => {
    res.status(404).send("<h1>404 - Route not found.</h1>");
});

// Error handler
app.use((err, req, res, next) => {
    const errors = {
        POST_UPDATE_FAILED: "Post update failed!",
        USER_UPDATE_FAILED: "User update failed!",
        COMMENT_UPDATE_FAILED: "Comment update failed!",
        POST_NOT_FOUND: "Post not found!",
        POST_DELETE_FAILED: "Post delete failed!",
        GIFT_REDEEM_FAILED: "Gift redeem failed!"
    }

    if (err.code === 11000) return res.status(400).json({ error: "You've already done this action!" });
    if (errors[err.message]) return res.status(400).json({ error: errors[err.message] });

    console.error("Error:", err.stack);
    return res.status(400).json({ error: "An unexpected error occurred" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clean Engine live on port ${PORT}`);
});
