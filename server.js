require("dotenv").config({
    quiet: true
});
const express = require("express");
const path = require("path");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { checkAuth, createErrorMessage, checkValidID, generateRecoveryCodes } = require("./helpers.js");
const schemas = require("./schemas.js");
const MongoStore = require("connect-mongo");
const bookmarksRouter = require("./bookmarks.js").router;
const actionsRouter = require("./actions.js").router;
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

app.post("/api/v1/get/posts/comments", async (req, res) => {
    try {
        const ids = req.body.ids;
        const skip = parseInt(req.body.skip) || 0;
        const customId = req.body.customId ? true : false;
        if (customId) {
            const isPublic = await schemas.Posts.findOne({
                _id: ids,
                $or: [
                    { forkerId: null, receiverId: null },
                    { forkerId: req.session.userId },
                    { receiverId: req.session.userId }
                ],
                private: false
            });

            if (!isPublic) return res.status(400).json({ error: "You don't have permissions to do this action." });

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
            const isPublic = await schemas.Posts.findOne({
                _id: id,
                $or: [
                    { forkerId: null, receiverId: null },
                    { forkerId: req.session.userId },
                    { receiverId: req.session.userId }
                ],
                private: false
            });

            if (!isPublic) throw new Error('ILLEGAL_BATCH'); 

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
        if (e.message === "ILLEGAL_BATCH") return res.status(400).json({ error: "You don't have permissions to do this action." });
        console.error("Fetch Comments Break: " + e.message);
        return res.status(500).json({ error: "Could not retrieve comments. Try again later." });
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
        }).limit(100).populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount");

        return res.status(200).json({ success: true, posts: foundPosts });
    } catch (e) {
        console.error("Search Posts Break: ", e.message);
        return res.status(500).json({ error: "Could not search posts. Try again later." });
    }
})

// User
app.post("/api/v1/get/user-private-posts", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const foundPosts = await schemas.Posts.find({
            by: req.session.userId,
            private: true,
            forkerId: null,
            receiverId: null
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

app.post("/api/v1/get/user-pinned-posts", checkAuth, async (req, res) => {
    try {
        const ids = req.body.ids;
        if (!Array.isArray(ids)) return res.status(400).json({ erorr: "Invalid request. 'ids' must be a type of array" });
        const postPromises = ids.map(id => schemas.Posts.findOne({
            _id: id,
            private: false,
            forkerId: null,
            receiverId: null
        }).lean());
        const pinnedPosts = await Promise.all(postPromises);

        return res.status(200).json({ success: true, foundPinnedPosts: pinnedPosts });
    } catch (e) {
        console.error("Failed To Get Pinned Post ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Something went wrong. Try again." });
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
        let { username, password, email, bio } = req.body;
        if (req.session.isLoggedIn) return res.status(400).json({ error: "You are already logged in!" });
        username = String(username).trim();
        password = String(password).trim();
        email = String(email).trim();
        bio = String(bio).trim();
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
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new schemas.Users({
            username: username,
            email: req.body.email.toLowerCase().trim(),
            password: hashedPassword,
            bio: bio || "",
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

        const result = await schemas.Users.updateOne({
            username: req.currentUser.username
        }, {
            $set: {
                bio: newBio
            }
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
        const result = await schemas.Users.updateOne({
            username: req.currentUser.username
        }, {
            $set: {
                emoji: emoji
            }
        }, {
            runValidators: true
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Can't find your account right now!" });

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Emoji Update Failure: ${e.message}. User ID: ${req.session.userId}`);
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
app.get("/api/v1/get/post/:id", checkValidID, async (req, res) => {
    try {
        const foundPost = await schemas.Posts.findOne({
            _id: req.params.id,
            $or: [
                { forkerId: null, receiverId: null },
                { forkerId: req.session.userId },
                { receiverId: req.session.userId }
            ],
            private: false
        }).populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
            .populate("forkerId", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
            .populate("receiverId", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount");
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
        }).sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(50)
            .populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
            .populate("forkerId", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
            .populate("receiverId", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount")
            .lean();

        return res.status(200).json({ success: true, posts });
    } catch (e) {
        console.error("Fetch Feed Break: ", e.message);
        return res.status(500).json({ error: "Could not retrieve feed index assets" });
    }
});

// User
app.get("/api/v1/get/current-user-quick-info", checkAuth, async (req, res) => {
    try {
        return res.status(200).json({ success: true, username: req.currentUser.username, emoji: req.currentUser.emoji, bio: req.currentUser.bio, maxPostContentCharsLength: req.currentUser.maxPostContentCharsLength });
    } catch (e) {
        console.error(`Failed To Get Username: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not get your username. Try again." });
    }
});

app.get("/api/v1/get/user-profile/:name", checkAuth, async function (req, res) {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const user = await schemas.Users.findOne({ username: req.params.name, private: false });
        if (!user) return res.status(400).json({ error: "User not found or their account is private!" });
        const foundPosts = await schemas.Posts.find({
            by: user._id,
            private: false,
            forkerId: null,
            receiverId: null
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

app.get("/api/v1/get/user-profile", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const foundPosts = await schemas.Posts.find({
            by: req.session.userId,
            forkerId: null,
            receiverId: null
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
            bio: req.currentUser.bio,
            private: req.currentUser.private
        });
    } catch (e) {
        console.error(`Failed To Get User: ${e.message}. User ID: ${req.session.userId}`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not find your account right now" });
    }
});

app.get("/api/v1/get/user-status", async function (req, res) {
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
