const mongoose = require("mongoose");
const globalDbConnection = mongoose.connection;

const usersSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    banned: { type: Boolean, default: false },
    bio: { type: String, required: true, trim: true },
    emoji: {
        type: String, default: "&#x1F3C7;&#x1F3FB;", enum: [
            "&#x1F680;",
            "&#x1F466;&#x1F3FB;",
            "&#x1F467;&#x1F3FB;",
            "&#x1F3C7;&#x1F3FB;"
        ]
    },
    email: {
        type: String,
        match: [/.+\@.+\..+/, 'Please fill a valid email address'],
        required: true
    },
    pinnedPosts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    pinnedPostsCount: { type: Number, default: 0 },
    recoveryCodes: { type: [String], default: [] },
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
    private: { type: Boolean, default: false }
}, { timestamps: true });
postsSchema.index({ createdAt: -1, _id: -1 });
postsSchema.index({ by: 1, createdAt: -1 });

const commentsSchema = new mongoose.Schema({
    content: String,
    for: mongoose.Schema.Types.ObjectId,
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users" }
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