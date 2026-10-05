import "express-async-errors";
import express from "express";
import path from "path";
import session from "express-session";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import { checkAuth, generateRecoveryCodes, createLimiter, hotQueries } from "./helpers.js";
import schemas from "./schemas.js";
import ClientError from "./client-error.js";
import bookmarksRouter from "./bookmarks.js";
import actionsRouter from "./actions.js";
import authRouter from "./auth.js";
import config from "./config/backend.js";
import {
    defaultPostFindValidator,
    getPostsValidator,
    searchPostsValidator,
    getPostCommentsValidator,
    getPostRepliesValidator,
    resetPasswordValidator,
    redeemGiftLinkValidator
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
    skip: (req) => ["/api/v1/reset/password", "/api/v1/posts/bulk"].some((path) => req.originalUrl.includes(path))
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
app.post("/api/v1/posts", checkAuth, defaultPostFindValidator, async (req, res) => {
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

app.get("/api/v1/get/post/:id", defaultPostFindValidator, async (req, res) => {
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

app.get("/api/v1/get/posts", getPostsValidator, async (req, res) => {
    const { skip, chronological } = req.cleanData;

    // Sort query
    const sortQuery = chronological
        ? { createdAt: -1, _id: -1 }
        : { level: -1, likes: -1, createdAt: -1, _id: -1 };

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

app.get("/api/v1/search/posts", searchPostsValidator, async (req, res) => {
    const query = req.cleanData.query;
    const posts = await schemas.Posts.find({
        keywords: query,
        private: false
    })
        .limit(config.POSTS_LIMIT)
        .sort({
            level: -1,
            likes: -1,
            createdAt: -1,
            _id: -1
        })
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, posts: posts });
});

app.get("/api/v1/get/post/comments/:id", checkAuth, getPostCommentsValidator, async (req, res) => {
    const { skip, id } = req.cleanData;

    const post = await schemas.Posts.exists(hotQueries.view_post(id, req.session.userId));
    if (!post) return res.status(400).json({ error: "Post not found!" });

    const comments = await schemas.Comments.find({ for: id, parentCommentId: null })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(config.COMMENTS_LIMIT)
        .select("for content by")
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, comments });
});

app.get("/api/v1/get/post/:postId/replies/:parentCommentId", checkAuth, getPostRepliesValidator, async (req, res) => {
    const { postId, parentCommentId } = req.cleanData;

    const post = await schemas.Posts.find(hotQueries.view_post(postId, req.session.userId));
    if (!post) return res.status(400).json({ error: "Post not found or you don't have permissions to see it!" });

    const replies = await schemas.Comments.find({
        for: postId,
        parentCommentId: parentCommentId
    })
        .populate("by", "-password -recoveryCodes -email")
        .lean();

    return res.status(200).json({ success: true, replies: replies });
});

// Password recovery
const passwordRecoveryLimiter = createLimiter(config.RATE_LIMIT_WINDOW_MS, config.AUTH_RATE_LIMIT_MAX_REQ);

app.post("/api/v1/reset/password", passwordRecoveryLimiter, resetPasswordValidator, async (req, res) => {
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

app.post("/api/v1/reset/password/recovery-codes", passwordRecoveryLimiter, checkAuth, async (req, res) => {
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

app.post("/api/v1/redeem/gift-link/:id", checkAuth, redeemGiftLinkValidator, async (req, res) => {
    const id = req.cleanData.id;
    const remaining = Math.max(0, config.COINS_MAX - req.currentUser.coins);
    const inc = Math.min(config.COINS_MIN, remaining);
    if (inc <= 0) return res.status(400).json({ error: "You already reached the max amount of coins!" });

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
        // Gift link redemption
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

        if (giftResult.matchedCount === 0) throw new ClientError("You may not have access to this gift!");

        // Update user's coins
        const userResult = await schemas.Users.updateOne({
            _id: req.session.userId,
            coins: { $lt: config.COINS_MAX }
        }, {
            $inc: {
                coins: inc
            }
        }, { session });

        if (userResult.matchedCount === 0) throw new ClientError(`You must've less than ${config.COINS_MAX} coins for this operation to succeed!`);
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

app.get("/api/v1/get/gifts", checkAuth, async (req, res) => {
    const gifts = await schemas.Gifts.find({ status: "active" });
    return res.status(200).json({ success: true, gifts });
});

app.use((req, res) => {
    res.status(404).send("<h1>404 - Route not found.</h1>");
});

app.use((err, req, res, next) => {
    if (err.code === 11000) return res.status(400).json({ error: "You've already done this action!" });
    if (err.isCustom) return res.status(err.statusCode).json({ error: err.message });

    console.log(err);
    return res.status(500).json({ error: "An unexpected error occurred!" });
});

app.listen(config.PORT, config.HOST, () => {
    console.log(`Clean Engine live on port ${config.PORT}`);
});