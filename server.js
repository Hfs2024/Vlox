require("dotenv").config({
    quiet: true
});
const express = require("express");
const path = require("path");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { checkAuth, createErrorMessage, checkValidID, cleanData, generateRecoveryCodes } = require("./helpers.js");
const schemas = require("./schemas.js");
const { MongoStore } = require("connect-mongo");
const bookmarksRouter = require("./bookmarks.js").router;
const actionsRouter = require("./posts-actions.js").router;
const app = express();

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

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

// Main route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

// Post, delete, and put routes
// Posts
app.post("/api/v1/posts", checkAuth, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ error: "Title and text content fields are strictly required" });
        if (title.length > 20 || content.length > 2000) return res.status(400).json({ error: "Title must be less than 20 chars and content should be less than 2000 chars" });

        const cleanedPayload = cleanData({ title, content });
        const newPost = new schemas.Posts({
            title: cleanedPayload.title,
            content: cleanedPayload.content,
            by: req.session.userId
        });

        await newPost.save();
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error("Write Post Failure: ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to create post. Please try again." });
    }
});

app.post("/api/get/posts/comments", async (req, res) => {
    try {
        const ids = req.body.ids;
        const skip = parseInt(req.body.skip) || 0;
        const customId = req.body.customId ? true : false;

        if (customId) {
            const isPublic = await schemas.Posts.findOne({ _id: ids, private: false });
            if (!isPublic) return res.status(400).json({ error: "This is not a public post!" });

            const comments = await schemas.Comments.find({ for: ids }) // It's already a string id
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(10)
                .select("for content by")
                .populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
                .lean();

            return res.status(200).json({ success: true, comments });
        }

        if (!Array.isArray(ids)) return res.status(400).json({ error: "Invalid request. 'ids' must be an array." });
        const commentPromises = ids.map(async id => {
            const isPublic = await schemas.Posts.findOne({ _id: id, private: false });
            if (!isPublic) return res.status(400).json({ error: "This is not a private post!" });

            const found = await schemas.Comments.find({ for: id })
                .sort({ createdAt: -1, _id: -1 })
                .limit(10)
                .select("for content by")
                .populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
                .lean();


            return [id, found];
        });

        const resolvedPairs = await Promise.all(commentPromises);
        const comments = Object.fromEntries(resolvedPairs);

        return res.status(200).json({ success: true, comments });
    } catch (e) {
        console.error("Fetch Comments Break: ", e.message);
        return res.status(500).json({ error: "Could not retrieve comments" });
    }
});

// User
app.post("/api/get/user-private-posts", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const foundPosts = await schemas.Posts.find({
            by: req.session.userId,
            private: true
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

app.post("/api/v1/login", async (req, res) => {
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

app.post("/api/v1/signup", async (req, res) => {
    try {
        const { username, password, email, bio } = req.body;
        if (req.session.isLoggedIn === true) return res.status(400).json({ error: "You are already logged in!" });
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
        if (existingUser) return res.status(409).json({ error: "Username already exists" });

        const recoveryCodes = await generateRecoveryCodes();
        const cleanedPayload = cleanData({ username, bio });
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new schemas.Users({
            username: cleanedPayload.username,
            email: req.body.email.toLowerCase().trim(),
            password: hashedPassword,
            bio: cleanedPayload.bio || "",
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

app.put("/api/v1/update/user-bio", checkAuth, async (req, res) => {
    try {
        const { newBio } = req.body;
        if (!newBio) return res.status(400).json({ error: "You didn't enter a bio!" });
        if (newBio.length > 20) return res.status(400).json({ error: "Bio should be less than 20 chars!" });

        const cleanedPayload = cleanData({ newBio });
        const result = await schemas.Users.updateOne({
            username: req.currentUser.username
        }, {
            $set: {
                bio: cleanedPayload.newBio
            }
        }, {
            new: true
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Could not find your account right now" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Bio Update Failure: ${e.message}. User ID: ${req.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to update bio. Try again." });
    }
});

app.put("/api/v1/update/emoji", checkAuth, async (req, res) => {
    try {
        const emoji = req.body.emoji ? req.body.emoji.normalize("NFC") : null;
        const cleanedPayload = cleanData({ emoji });
        const result = await schemas.Users.updateOne({
            username: req.currentUser.username
        }, {
            $set: {
                emoji: cleanedPayload.emoji
            }
        }, {
            runValidators: true, new: true
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Can't find your account right now!" });

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Emoji Update Failure: ${e.message}. User ID: ${req.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to update emoji. Try again." });
    }
});

app.delete("/api/v1/signout", checkAuth, async (req, res) => {
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

// Get routes
// Posts
app.get("/api/get/post/:id", checkValidID, async (req, res) => {
    try {
        const foundPost = await schemas.Posts.findOne({ _id: req.params.id, private: false }).populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount");
        if (!foundPost) return res.status(400).json({ error: "Post not found!" });
        return res.status(200).json({ success: true, posts: [foundPost] });
    } catch (e) {
        console.error(`Failed To Get Post: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not get this post. Try again." });
    }
});

app.get("/api/get/posts", async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const posts = await schemas.Posts.find({ private: false })
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(50)
            .populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
            .lean();

        return res.status(200).json({ success: true, posts });
    } catch (e) {
        console.error("Fetch Feed Break: ", e.message);
        return res.status(500).json({ error: "Could not retrieve feed index assets" });
    }
});

// User
app.get("/api/get/current-user-quick-info", checkAuth, async (req, res) => {
    try {
        return res.status(200).json({ success: true, username: req.currentUser.username, emoji: req.currentUser.emoji, bio: req.currentUser.bio });
    } catch (e) {
        console.error(`Failed To Get Username: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not get your username. Try again." });
    }
});

app.get("/api/get/user-profile/:name", checkAuth, async function (req, res) {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const user = await schemas.Users.findOne({ username: req.params.name });
        if (!user) return res.status(400).json({ error: "User not found!" });
        const foundPosts = await schemas.Posts.find({
            by: user._id,
            private: false
        }).sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .populate("by", "-password -recoveryCodes -email")
            .lean();

        return res.status(200).json({ success: true, posts: foundPosts, username: user.username, emoji: user.emoji, pinnedPosts: user.pinnedPosts, bio: user.bio });
    } catch (e) {
        console.error(`Failed To Get User: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not find your account right now" });
    }
});

app.get("/api/get/user-profile", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const foundPosts = await schemas.Posts.find({
            by: req.session.userId
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
            pinnedPosts: req.currentUser.pinnedPosts,
            bio: req.currentUser.bio
        });
    } catch (e) {
        console.error(`Failed To Get User: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not find your account right now" });
    }
});

app.get("/api/get/user-status", async function (req, res) {
    try {
        return res.status(200).json({ success: true, loggedIn: req?.session?.isLoggedIn ? true : false }); // Ensure it's a boolean
    } catch (e) {
        console.error(`Failed To Get User Status: ${e.message}. User ID: ${req.session.userId} `);
        return res.status(500).json({ error: "Could not find your status right now" });
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
                    username: username
                }, {
                    $set: {
                        password: await bcrypt.hash(newPassword, 10)
                    },

                    $pull: {
                        recoveryCodes: code
                    }
                }, {
                    new: true
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
            username: req.currentUser.username
        }, {
            $set: {
                recoveryCodes: newCodes.hashed
            }
        }, {
            new: true
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
