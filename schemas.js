const mongoose = require('mongoose');
const globalDbConnection = mongoose.connection;

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
    pinnedPosts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    pinnedPostsCount: { type: Number, default: 0 },
    recoveryCodes: { type: [String], default: [] },
    maxPostContentCharsLength: { type: Number, default: 2000 },
    private: { type: Boolean, default: false },
}, { timestamps: true });

const reactionsSchema = new mongoose.Schema({
    type: String,
    by: String,
    for: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });
reactionsSchema.index({ by: 1, for: 1, type: 1 }, { unique: true });

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
    rootId: { type: mongoose.Schema.Types.ObjectId, default: null },
    receiverId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "Users" },
    forkerId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: "Users" },
    keywords: { type: [String], default: [] }
}, { timestamps: true });
postsSchema.index({ createdAt: -1, _id: -1 });
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

const commentsSchema = new mongoose.Schema({
    content: String,
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts" },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    rootId: { type: mongoose.Schema.Types.ObjectId, default: null },
    repliesCount: Number
}, { timestamps: true });

const errorLogsSchema = new mongoose.Schema({
    errorType: String,
    errorMessage: String,
    errorRoute: String,
    userId: mongoose.Schema.Types.ObjectId,
    createdAt: {
        type: Date,
        expires: "7d"
    }
}, { timestamps: true });


const bookmarksSchema = new mongoose.Schema({
    postId: mongoose.Schema.Types.ObjectId,
    by: String,
    title: String
}, { timestamps: true });
bookmarksSchema.index({ postId: 1, by: 1 }, { unique: true });

module.exports = {
    Users: mongoose.model("Users", usersSchema, "users"),
    Reactions: mongoose.model("Reactions", reactionsSchema, "reactions"),
    Posts: mongoose.model("Posts", postsSchema, "posts"),
    Comments: mongoose.model("Comments", commentsSchema, "comments"),
    ErrorLogs: mongoose.model("ErrorLogs", errorLogsSchema, "error_logs"),
    Bookmarks: mongoose.model("Bookmarks", bookmarksSchema, "bookmarks")
};