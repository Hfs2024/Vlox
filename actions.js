const schemas = require("./schemas.js");
const { checkAuth, validateResult, hotQueries } = require("./helpers.js");
const { body, query, param } = require("express-validator");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Change visibility
router.put("/api/v1/change-visibility/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("value").exists().isIn([true, false])
], validateResult, async (req, res) => {
    const { id, value } = req.cleanData;
    const result = await schemas.Posts.updateOne({
        ...hotQueries.modify_post(id, req.session.userId), pinned: false
    }, {
        $set: {
            private: value
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found or post is private!" });
    return res.status(200).json({ success: true });
});

// Pin and unpin
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

// Create comment
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

// Create reply
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

// Fork post
router.post("/api/v1/fork/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("receiverUsername").exists().notEmpty().isString().isLength({ min: 3, max: 10 }).toLowerCase().trim()
], validateResult, async (req, res) => {
    const id = req.params.id;
    const { receiverUsername } = req.body;
    // Does the user and post exist?
    if (receiverUsername === req.currentUser.username) return res.status(400).json({ error: "You can't chat with yourself 😅" });
    const user = await schemas.Users.findOne({ username: receiverUsername, private: false }); // All private accounts can't be a fork receiver
    if (!user) return res.status(400).json({ error: "User not found" });
    const post = await schemas.Posts.findOne({ _id: id, boosted: false, private: false, receiverId: null, forkerId: null }); // All boosted/private posts can't be forked
    if (!post) return res.status(400).json({ error: "Post not found!" });

    // Fork
    const newPost = new schemas.Posts({
        title: post.title,
        content: post.content,
        by: post.by,
        receiverId: user._id,
        forkerId: req.session.userId,
        rootId: post._id
    });

    await newPost.save();
    return res.status(200).json({ success: true });
});

// Redeem post
router.post("/api/v1/redeem/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const session = await mongoose.startSession();
    const remaining = 4000 - req.currentUser.maxPostContentCharsLength;
    let inc = 100;
    if (remaining < 100) inc = remaining;
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

// Edit comment
router.put("/api/v1/edit/post/comment/:id", checkAuth, [
    body("commentId").exists().isMongoId(),
    body("newComment").exists().notEmpty().isString().isLength({ max: 200 }).trim(),
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const { newComment, commentId, id } = req.cleanData;
    const result = await schemas.Comments.updateOne({
        for: id,
        _id: commentId,
        by: req.session.userId
    }, {
        $set: {
            content: newComment
        }
    });

    if (!result) return res.status(400).json({ error: "Comment not found or it's not your comment!" });
    return res.status(200).json({ success: true });
});

// Edit post
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
            keywords: newKeywords.filter(Boolean).map(kw => kw.toLowerCase().trim()),
            spoilers: newSpoilers
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found!" });
    return res.status(200).json({ success: true });
});

// Delete post and forks
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

        await schemas.Reactions.deleteMany({
            for: id
        }, { session });
        await schemas.Comments.deleteMany({
            for: id
        }, { session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.delete("/api/v1/delete/fork/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;
    await session.withTransaction(async () => {
        const result = await schemas.Posts.deleteOne({
            _id: id,
            $or: [
                { forkerId: req.session.userId },
                { receiverId: req.session.userId }
            ] // Are you the receiver or the forker of the post?
        }, { session });

        if (result.deletedCount === 0) throw new Error("FORK_DELETE_FAILED");

        await schemas.Reactions.deleteMany({
            for: id
        });
        await schemas.Comments.deleteMany({
            for: id
        });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

module.exports = {
    router
}