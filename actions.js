const schemas = require("./schemas.js");
const { checkAuth, validateResult, hotQueries } = require("./helpers.js");
const { body, param } = require("express-validator");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Change post visibility
router.put("/api/v1/change-visibility/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("value").exists().isIn([true, false])
], validateResult, async (req, res) => {
    const { id, value } = req.cleanData;
    const result = await schemas.Posts.updateOne({
        ...hotQueries.modify_post(id, req.session.userId),
        pinned: false
    }, {
        $set: {
            private: value
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found or post is private!" });
    return res.status(200).json({ success: true });
});

// Pin and unpin posts
router.post("/api/v1/pin/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("value").exists().isIn([true, false])
], validateResult, async function (req, res) {
    const session = await mongoose.startSession();
    const { id, value } = req.cleanData;

    await session.withTransaction(async () => {
        // Save
        const postUpdate = await schemas.Posts.updateOne({
            ...hotQueries.modify_post(id, req.session.userId),
            private: false,
            pinned: value ? false : true // Opposite!
        }, { pinned: value }, { session });
        if (postUpdate.matchedCount === 0) throw new Error("POST_UPDATE_FAILED");

        // Inc
        const userFindQuery = { _id: req.session.userId }
        if (value) userFindQuery.pinnedPostsCount = { $lt: 10 };

        const userUpdate = await schemas.Users.updateOne(userFindQuery, {
            $inc: {
                pinnedPostsCount: value ? 1 : -1
            }
        }, { session });

        if (userUpdate.matchedCount === 0) throw new Error("USER_UPDATE_FAILED");
    });

    session.endSession();
    return res.status(200).json({ success: true });
});

// Create comments and replies
router.post("/api/v1/comment/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("comment").exists().notEmpty().isString().isLength({ max: 200 }).trim()
], validateResult, async (req, res) => {
    const session = await mongoose.startSession();
    const { id, comment } = req.cleanData;
    await session.withTransaction(async () => {
        // Insert comment
        const newComment = new schemas.Comments({
            content: comment,
            for: id,
            by: req.session.userId,
            rootId: null
        });

        await newComment.save({ session });

        // Inc comments
        const result = await schemas.Posts.updateOne(hotQueries.view_post(id, req.session.userId), {
            $inc: {
                comments: 1
            }
        }, { session });

        if (result.matchedCount === 0) throw new Error("COMMENT_UPDATE_FAILED");
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.post("/api/v1/reply/comment/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("rootId").exists().isMongoId(),
    body("reply").exists().notEmpty().isString().isLength({ max: 200 }).trim()
], validateResult, async (req, res) => {
    const session = await mongoose.startSession();
    const { id, reply, rootId } = req.cleanData;

    await session.withTransaction(async () => {
        // Find post
        const post = await schemas.Posts.findOne(hotQueries.view_post(id, req.session.userId));
        if (!post) throw new Error("POST_NOT_FOUND");

        // Add reply
        const newReply = new schemas.Comments({
            content: reply,
            rootId: rootId,
            for: id,
            by: req.session.userId
        });

        await newReply.save({ session });

        // Inc comments
        const result = await schemas.Comments.updateOne({
            _id: rootId,
            for: id,
            repliesCount: { $lt: 10 }
        }, {
            $inc: {
                repliesCount: 1
            }
        }, { session });

        if (result.matchedCount === 0) throw new Error("COMMENT_UPDATE_FAILED");
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

// Redeem post
router.post("/api/v1/redeem/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const session = await mongoose.startSession();
    const remaining = Math.max(0, 4000 - req.currentUser.maxPostContentCharsLength);
    const inc = Math.min(100, remaining);
    if (inc <= 0) return res.status(400).json({ error: "Post redeem failed!" });
    const id = req.cleanData.id;

    await session.withTransaction(async () => {
        const postResult = await schemas.Posts.updateOne({
            ...hotQueries.modify_post(id, req.session.userId),
            likes: { $gte: 100 },
            redeemed: false,
        }, {
            $set: {
                redeemed: true
            }
        }, { session });

        if (postResult.matchedCount === 0) throw new Error("POST_UPDATE_FAILED");

        const userResult = await schemas.Users.updateOne({
            _id: req.session.userId,
            maxPostContentCharsLength: { $lt: 4000 }
        }, {
            $inc: {
                maxPostContentCharsLength: inc
            }
        }, { session });

        if (userResult.matchedCount === 0) throw new Error("USER_UPDATE_FAILED");
    });

    await session.endSession();
    return res.status(200).json({ success: true, inc: inc });
});

// Likes/Report post
router.post("/api/v1/react/:action/post/:id", checkAuth, [
    param("action").exists().notEmpty().isString().isIn(["like", "report"]),
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const session = await mongoose.startSession();
    const { action, id } = req.cleanData;

    await session.withTransaction(async () => {
        const newReaction = new schemas.Reactions({
            by: req.session.userId,
            for: id,
            type: action
        });

        await newReaction.save({ session });

        const result = await schemas.Posts.updateOne(hotQueries.view_post(id, req.session.userId),
            {
                $inc: {
                    likes: action === "like" ? 1 : 0,
                    reports: action === "report" ? 1 : 0
                }
            }, {
            session
        });

        if (result.matchedCount === 0) throw new Error("POST_UPDATE_FAILED");
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

// Edit posts and comments
router.put("/api/v1/edit/post/comment/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("newComment").exists().notEmpty().isString().isLength({ max: 200 }).trim(),
], validateResult, async (req, res) => {
    const { newComment, id } = req.cleanData;
    const result = await schemas.Comments.updateOne({
        _id: id,
        by: req.session.userId
    }, {
        $set: {
            content: newComment
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Comment not found or isn't yours!" });
    return res.status(200).json({ success: true });
});

router.put("/api/v1/edit/post/:id", checkAuth, [
    body("newTitle").exists().notEmpty().isString().isLength({ max: 20 }).trim(),
    body("newContent").exists().notEmpty().isString().trim().custom((value, { req }) => {
        if (value?.length > req.currentUser.maxPostContentCharsLength) return false;
        return true;
    }),
    body("newSpoilers").exists().isIn([true, false]),
    body("newKeywords").exists().isArray({ max: 5 }).customSanitizer(value => value?.filter(Boolean)?.map(kw => kw.toLowerCase().trim())),
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const { newContent, newTitle, id, newKeywords, newSpoilers } = req.cleanData;
    const result = await schemas.Posts.updateOne(hotQueries.modify_post(id, req.session.userId), {
        $set: {
            content: newContent,
            title: newTitle,
            keywords: newKeywords,
            spoilers: newSpoilers
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found!" });
    return res.status(200).json({ success: true });
});

// Delete post
router.delete("/api/v1/delete/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async function (req, res) {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;
    await session.withTransaction(async () => {
        const result = await schemas.Posts.deleteOne({
            ...hotQueries.modify_post(id, req.session.userId),
            pinned: false
        }, { session });
        if (result.deletedCount === 0) throw new Error("POST_DELETE_FAILED");

        // Remove reactions
        await schemas.Reactions.deleteMany({
            for: id
        }, { session });

        // Remove comments
        await schemas.Comments.deleteMany({
            for: id
        }, { session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

module.exports = {
    router
}