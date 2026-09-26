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
    const result = await schemas.Posts.updateOne(hotQueries.modify_post(id, req.session.userId), {
        $set: {
            private: value
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found or post is private!" });
    return res.status(200).json({ success: true });
});

// Create comments and replies
router.post("/api/v1/comment/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("comment").exists().notEmpty().isString().isLength({ max: 200 }).trim()
], validateResult, async (req, res) => {
    const { id, comment } = req.cleanData;

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
        // Inc comments and check for permissions to see the post
        const postUpdate = await schemas.Posts.updateOne(hotQueries.view_post(id, req.session.userId), {
            $inc: {
                comments: 1
            }
        }, { session });

        if (postUpdate.matchedCount === 0) throw new Error("COMMENT_UPDATE_FAILED");

        // Insert comment
        const newComment = new schemas.Comments({
            content: comment,
            for: id,
            by: req.session.userId
        });

        await newComment.save({ session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.post("/api/v1/reply/comment/:parentCommentId/post/:postId", checkAuth, [
    param("postId").exists().isMongoId(),
    param("parentCommentId").exists().isMongoId(),
    body("reply").exists().notEmpty().isString().isLength({ max: 200 }).trim()
], validateResult, async (req, res) => {
    const { postId, reply, parentCommentId } = req.cleanData;

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
        // Find post
        const post = await schemas.Posts.exists(hotQueries.view_post(postId, req.session.userId));
        if (!post) throw new Error("POST_NOT_FOUND");

        // Add reply
        const newReply = new schemas.Comments({
            content: reply,
            parentCommentId: parentCommentId,
            for: postId,
            by: req.session.userId
        });

        await newReply.save({ session });

        // Inc comments
        const result = await schemas.Comments.updateOne({
            _id: parentCommentId,
            for: postId,
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
    const remaining = Math.max(0, 4000 - req.currentUser.maxPostsLength);
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
            maxPostsLength: { $lt: 4000 }
        }, {
            $inc: {
                maxPostsLength: inc
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
router.put("/api/v1/edit/post/:postId/comment/:commentId", checkAuth, [
    param("postId").exists().isMongoId(),
    param("commentId").exists().isMongoId(),
    body("newComment").exists().notEmpty().isString().isLength({ max: 200 }).trim(),
], validateResult, async (req, res) => {
    const { newComment, postId, commentId } = req.cleanData;

    // Check post permissions
    const post = await schemas.Posts.find(hotQueries.view_post(postId, req.session.userId));
    if (!post) return res.status(400).json({ error: "Post not found or you don't have permissions to see it" });

    // Update comment
    const result = await schemas.Comments.updateOne({
        _id: commentId,
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
        if (value?.length > req.currentUser.maxPostsLength) return false;
        return true;
    }),
    body("newKeywords").exists().isArray({ max: 5 }).customSanitizer(value => value?.filter(Boolean)?.map(kw => kw.toLowerCase().trim())),
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const { newContent, newTitle, id, newKeywords } = req.cleanData;
    const result = await schemas.Posts.updateOne(hotQueries.modify_post(id, req.session.userId), {
        $set: {
            content: newContent,
            title: newTitle,
            keywords: newKeywords
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
        const result = await schemas.Posts.deleteOne(hotQueries.modify_post(id, req.session.userId), { session });
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