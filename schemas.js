import mongoose from "mongoose";
import config from "./config/backend.js";

const usersSchema = new mongoose.Schema({
    username: { type: String, trim: true, required: true, lowercase: true, minLength: config.USERNAME_MIN_LENGTH, maxLength: config.USERNAME_MAX_LENGTH },
    password: { type: String, required: true },
    bio: { type: String, trim: true, required: true, minLength: config.BIO_MIN_LENGTH, maxLength: config.BIO_MAX_LENGTH },
    email: {
        type: String,
        trim: true,
        match: /.+\@.+\..+/,
        required: true,
        maxLength: config.EMAIL_MAX_LENGTH
    },
    recoveryCodes: { type: [String], default: [] },
    private: { type: Boolean, default: false }
}, { timestamps: true });

usersSchema.index({ username: 1 }, { unique: true });
usersSchema.index({ email: 1 }, { unique: true });

const likesSchema = new mongoose.Schema({
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
}, { timestamps: true });

likesSchema.index({ by: 1, for: 1 }, { unique: true });

const postsSchema = new mongoose.Schema({
    title: { type: String, trim: true, required: true, maxLength: config.POST_TITLE_MAX_LENGTH },
    content: { type: String, trim: true, required: true, maxLength: config.POST_CONTENT_MAX_LENGTH },
    likes: { type: Number, default: 0, min: 0 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    private: { type: Boolean, default: false },
    redeemed: { type: Boolean, default: false },
    keywords: { type: [String], default: [] }
}, { timestamps: true });

postsSchema.index({ by: 1 });
postsSchema.index({ keywords: 1 });
postsSchema.index({ likes: -1, createdAt: -1, _id: -1 });

const bookmarksSchema = new mongoose.Schema({
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    title: { type: String, trim: true, required: true, maxLength: config.POST_TITLE_MAX_LENGTH }
}, { timestamps: true });

bookmarksSchema.index({ for: 1, by: 1 }, { unique: true });

const commentsSchema = new mongoose.Schema({
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    content: { type: String, trim: true, required: true, maxLength: config.COMMENTS_MAX_LENGTH }
}, { timestamps: true });

commentsSchema.index({ for: 1 });

export default {
    Users: mongoose.model("Users", usersSchema, "users"),
    Likes: mongoose.model("Likes", likesSchema, "likes"),
    Posts: mongoose.model("Posts", postsSchema, "posts"),
    Bookmarks: mongoose.model("Bookmarks", bookmarksSchema, "bookmarks"),
    Comments: mongoose.model("Comments", commentsSchema, "comments")
};