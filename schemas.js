const mongoose = require('mongoose');

// Users
const usersSchema = new mongoose.Schema({
    username: { type: String, trim: true, required: true, lowercase: true, minLength: 3, maxLength: 10 },
    password: { type: String, required: true }, // Validated on the server-side because the value becomes a hash
    bio: { type: String, trim: true, required: true, minLength: 5, maxLength: 20 },
    emoji: {
        type: String,
        default: "🚀",
        enum: ["🚀", "👦🏻", "👧🏻", "🐣", "🏇🏻"]
    },
    email: {
        type: String,
        trim: true,
        match: /.+\@.+\..+/,
        required: true,
        maxLength: 100
    },
    recoveryCodes: { type: [String], default: [] },
    coins: { type: Number, default: 100, min: 0, max: 5000 },
    private: { type: Boolean, default: false }
}, { timestamps: true });

usersSchema.index({ username: 1 }, { unique: true });
usersSchema.index({ email: 1 }, { unique: true });

// Reactions
const reactionsSchema = new mongoose.Schema({
    type: { type: String, enum: ["like", "report"], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
}, { timestamps: true });

reactionsSchema.index({ by: 1, for: 1, type: 1 }, { unique: true });

// Posts
const postsSchema = new mongoose.Schema({
    title: { type: String, trim: true, required: true, maxLength: 20 },
    content: { type: String, trim: true, required: true, maxLength: 1000 }, // Validated in the server-side because its value is dynamic
    likes: { type: Number, default: 0, min: 0 },
    reports: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    private: { type: Boolean, default: false },
    redeemed: { type: Boolean, default: false },
    keywords: { type: [String], default: [] },
    level: { type: Number, default: 1, min: 1, max: 10 }
}, { timestamps: true });

postsSchema.index({ by: 1 });
postsSchema.index({ likes: 1 });
postsSchema.index({ keywords: 1 });
postsSchema.index({ createdAt: -1, _id: -1 });

// Comments
const commentsSchema = new mongoose.Schema({
    content: { type: String, trim: true, required: true, maxLength: 200 },
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "Comments" },
    repliesCount: { type: Number, default: 0, min: 0, max: 10 }
}, { timestamps: true });

commentsSchema.index({ for: 1, parentCommentId: 1 });

// Bookmarks
const bookmarksSchema = new mongoose.Schema({
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    title: { type: String, trim: true, required: true, maxLength: 20 }
}, { timestamps: true });

bookmarksSchema.index({ for: 1, by: 1 }, { unique: true });

// Gifts
const giftsSchema = new mongoose.Schema({
    usedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    usedCount: { type: Number, default: 0, min: 0 },
    usesCount: { type: Number, required: true, max: 100 },
    name: { type: String, trim: true, required: true, maxLength: 100 },
    status: { type: String, enum: ["active", "expired"], default: "active" },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: "1d"
    }
}, { timestamps: true });

giftsSchema.index({ name: 1 }, { unique: true });

// Export
module.exports = {
    Users: mongoose.model("Users", usersSchema, "users"),
    Reactions: mongoose.model("Reactions", reactionsSchema, "reactions"),
    Posts: mongoose.model("Posts", postsSchema, "posts"),
    Comments: mongoose.model("Comments", commentsSchema, "comments"),
    Bookmarks: mongoose.model("Bookmarks", bookmarksSchema, "bookmarks"),
    Gifts: mongoose.model("Gifts", giftsSchema, "gifts")
}