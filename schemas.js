const mongoose = require('mongoose');

// Users
const usersSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    banned: { type: Boolean, default: false },
    bio: { type: String, required: true, trim: true },
    emoji: {
        type: String, default: "🚀", enum: ["🚀", "👦🏻", "👧🏻", "🏇🏻"]
    },
    email: {
        type: String,
        match: [/.+\@.+\..+/, 'Please fill a valid email address'],
        required: true
    },
    pinnedPostsCount: { type: Number, default: 0 },
    recoveryCodes: { type: [String], default: [] },
    maxPostContentCharsLength: { type: Number, default: 2000 },
    private: { type: Boolean, default: false }
}, { timestamps: true });

usersSchema.index({ username: 1 }, { unique: true });
usersSchema.index({ email: 1 }, { unique: true });

// Reactions
const reactionsSchema = new mongoose.Schema({
    type: { type: String, enum: ["like", "report"] },
    by: mongoose.Schema.Types.ObjectId,
    for: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });
reactionsSchema.index({ by: 1, for: 1, type: 1 }, { unique: true });

// Posts
const postsSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    likes: { type: Number, default: 0 },
    reports: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    spoilers: { type: Boolean, default: false },
    private: { type: Boolean, default: false },
    redeemed: { type: Boolean, default: false },
    boosted: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    rootId: { type: mongoose.Schema.Types.ObjectId, default: null },
    receiverId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "Users" },
    forkerId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "Users" },
    keywords: { type: [String], default: [] }
}, { timestamps: true });
postsSchema.index({ boosted: -1, createdAt: -1, _id: -1 });
postsSchema.index({ by: 1, createdAt: -1 });
postsSchema.index(
    { rootId: 1, receiverId: 1, forkerId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            rootId: { $exists: true, $ne: null },
            receiverId: { $exists: true, $ne: null },
            forkerId: { $exists: true, $ne: null }
        }
    }
);

// Comments
const commentsSchema = new mongoose.Schema({
    content: String,
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts" },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    rootId: { type: mongoose.Schema.Types.ObjectId, default: null },
    repliesCount: { type: Number, default: 0 }
}, { timestamps: true });
commentsSchema.index({ for: 1, rootId: 1 });

// Bookmarks
const bookmarksSchema = new mongoose.Schema({
    for: mongoose.Schema.Types.ObjectId,
    by: mongoose.Schema.Types.ObjectId,
    title: String
}, { timestamps: true });
bookmarksSchema.index({ for: 1, by: 1 }, { unique: true });

// Gifts
const giftsSchema = new mongoose.Schema({
    usedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    usedCount: { type: Number, default: 0 },
    usesCount: { type: Number, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["active", "expired"], default: "active" },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: "1d"
    }
}, { timestamps: true });
giftsSchema.index({ name: 1 }, { unique: true });

module.exports = {
    Users: mongoose.model("Users", usersSchema, "users"),
    Reactions: mongoose.model("Reactions", reactionsSchema, "reactions"),
    Posts: mongoose.model("Posts", postsSchema, "posts"),
    Comments: mongoose.model("Comments", commentsSchema, "comments"),
    Bookmarks: mongoose.model("Bookmarks", bookmarksSchema, "bookmarks"),
    Gifts: mongoose.model("Gifts", giftsSchema, "gifts")
};