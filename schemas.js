import mongoose from "mongoose";
import config from "./config/backend.js";

const usersSchema = new mongoose.Schema({
    username: { type: String, trim: true, required: true, lowercase: true, minLength: config.USERNAME_MIN_LENGTH, maxLength: config.USERNAME_MAX_LENGTH },
    password: { type: String, required: true },
    bio: { type: String, trim: true, required: true, minLength: config.BIO_MIN_LENGTH, maxLength: config.BIO_MAX_LENGTH },
    emoji: {
        type: String,
        default: "🚀",
        enum: config.EMOJIS
    },
    email: {
        type: String,
        trim: true,
        match: /.+\@.+\..+/,
        required: true,
        maxLength: config.EMAIL_MAX_LENGTH
    },
    recoveryCodes: { type: [String], default: [] },
    coins: { type: Number, default: config.COINS_MIN, min: 0, max: config.COINS_MAX },
    private: { type: Boolean, default: false }
}, { timestamps: true });

usersSchema.index({ username: 1 }, { unique: true });
usersSchema.index({ email: 1 }, { unique: true });

const reactionsSchema = new mongoose.Schema({
    type: { type: String, enum: ["like", "report"], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
}, { timestamps: true });

reactionsSchema.index({ by: 1, for: 1, type: 1 }, { unique: true });

const postsSchema = new mongoose.Schema({
    title: { type: String, trim: true, required: true, maxLength: config.POST_TITLE_MAX_LENGTH },
    content: { type: String, trim: true, required: true, maxLength: config.POST_CONTENT_MAX_LENGTH },
    likes: { type: Number, default: 0, min: 0 },
    reports: { type: Number, default: 0, min: 0 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    private: { type: Boolean, default: false },
    redeemed: { type: Boolean, default: false },
    keywords: { type: [String], default: [] },
    level: { type: Number, default: config.POST_LEVEL_MIN, min: config.POST_LEVEL_MIN, max: config.POST_LEVEL_MAX }
}, { timestamps: true });

postsSchema.index({ by: 1 });
postsSchema.index({ keywords: 1 });
postsSchema.index({ level: -1, likes: -1, createdAt: -1, _id: -1 });

const bookmarksSchema = new mongoose.Schema({
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Posts", required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
    title: { type: String, trim: true, required: true, maxLength: config.POST_TITLE_MAX_LENGTH }
}, { timestamps: true });

bookmarksSchema.index({ for: 1, by: 1 }, { unique: true });

const giftsSchema = new mongoose.Schema({
    usedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    usedCount: { type: Number, default: 0, min: 0 },
    usesCount: { type: Number, required: true, max: config.GIFT_USES_MAX },
    name: { type: String, trim: true, required: true, maxLength: config.GIFT_NAME_MAX_LENGTH },
    status: { type: String, enum: ["active", "expired"], default: "active" },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: "1d"
    }
}, { timestamps: true });

giftsSchema.index({ name: 1 }, { unique: true });

export default {
    Users: mongoose.model("Users", usersSchema, "users"),
    Reactions: mongoose.model("Reactions", reactionsSchema, "reactions"),
    Posts: mongoose.model("Posts", postsSchema, "posts"),
    Bookmarks: mongoose.model("Bookmarks", bookmarksSchema, "bookmarks"),
    Gifts: mongoose.model("Gifts", giftsSchema, "gifts")
};