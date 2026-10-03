import schemas from "./schemas.js";
import { checkAuth, validateResult, hotQueries } from "./helpers.js";
import { body, param } from "express-validator";
import express from "express";
import mongoose from "mongoose";
import ClientError from "./client-error.js";
import config from "./config/backend.js";
const router = express.Router();

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

router.post("/api/v1/comment/post/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("comment").exists().notEmpty().isString().isLength({ max: config.COMMENT_CONTENT_MAX_LENGTH }).trim()
], validateResult, async (req, res) => {
    const { id, comment } = req.cleanData;

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
        const postUpdate = await schemas.Posts.updateOne(hotQueries.view_post(id, req.session.userId), {
            $inc: {
                comments: 1
            }
        }, { session });

        if (postUpdate.matchedCount === 0) throw new ClientError("You may not have access to this comment!");

        // Insert the new comment
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
    body("reply").exists().notEmpty().isString().isLength({ max: config.COMMENT_CONTENT_MAX_LENGTH }).trim()
], validateResult, async (req, res) => {
    const { postId, reply, parentCommentId } = req.cleanData;

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
        // Update parent replies count
        const result = await schemas.Comments.updateOne({
            _id: parentCommentId,
            for: postId,
            repliesCount: { $lt: config.COMMENT_REPLIES_MAX }
        }, {
            $inc: {
                repliesCount: 1
            }
        }, { session });

        if (result.matchedCount === 0) throw new ClientError("You may not have access to this comment or its replies count is already 10!");

        
        // Insert the new reply
        const newReply = new schemas.Comments({
            content: reply,
            parentCommentId: parentCommentId,
            for: postId,
            by: req.session.userId
        });

        await newReply.save({ session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.post("/api/v1/inc-lvl/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const id = req.cleanData.id;
    if (req.currentUser.coins < config.COINS_MIN) return res.status(400).json({ error: "You don't have enough coins!" });

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
        const incPostLvlResult = await schemas.Posts.updateOne({
            ...hotQueries.modify_post(id, req.session.userId),
            level: { $lt: config.POST_LEVEL_MAX }
        }, {
            $inc: {
                level: 1
            }
        }, { session });

        if (incPostLvlResult.matchedCount === 0) throw new ClientError("You may not have access to this post!");

        const withdrawCoinsResult = await schemas.Users.updateOne({
            _id: req.session.userId,
            coins: { $gte: config.COINS_MIN }
        }, {
            $inc: {
                coins: -config.COINS_MIN
            }
        }, { session });

        if (withdrawCoinsResult.matchedCount === 0) throw new ClientError("You don't have enough coins!");
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.post("/api/v1/redeem/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const session = await mongoose.startSession();
    const remaining = Math.max(0, config.COINS_MAX - req.currentUser.coins);
    const inc = Math.min(config.COINS_MIN, remaining);
    if (inc <= 0) return res.status(400).json({ error: "You already reached the max amount of coins!" });
    const postId = req.cleanData.id;

    await session.withTransaction(async () => {
        // Update post redeemed status
        const postResult = await schemas.Posts.updateOne({
            ...hotQueries.modify_post(postId, req.session.userId),
            likes: { $gte: config.POST_REDEEM_LIKES_REQUIRED },
            redeemed: false
        }, {
            $set: {
                redeemed: true
            }
        }, { session });

        if (postResult.matchedCount === 0) throw new ClientError("This post isn't redeemabled!");

        // Update user coins
        const userResult = await schemas.Users.updateOne({
            _id: req.session.userId,
            coins: { $lt: config.COINS_MAX }
        }, {
            $inc: {
                coins: inc
            }
        }, { session });

        if (userResult.matchedCount === 0) throw new ClientError(`You must've less than ${config.COINS_MAX} coins for this operation to succeed!`);
    });

    await session.endSession();
    return res.status(200).json({ success: true, inc: inc });
});

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

        const updatePostResult = await schemas.Posts.updateOne(hotQueries.view_post(id, req.session.userId),
            {
                $inc: {
                    likes: action === "like" ? 1 : 0,
                    reports: action === "report" ? 1 : 0
                }
            }, {
            session
        });

        if (updatePostResult.matchedCount === 0) throw new ClientError("You may not have access to this post!");
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.put("/api/v1/edit/post/:postId/comment/:commentId", checkAuth, [
    param("postId").exists().isMongoId(),
    param("commentId").exists().isMongoId(),
    body("newComment").exists().notEmpty().isString().isLength({ max: config.COMMENT_CONTENT_MAX_LENGTH }).trim(),
], validateResult, async (req, res) => {
    const { newComment, postId, commentId } = req.cleanData;
    const post = await schemas.Posts.find(hotQueries.view_post(postId, req.session.userId));
    if (!post) return res.status(400).json({ error: "Post not found or you don't have permissions to see it" });

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
    body("newTitle").exists().notEmpty().isString().trim().isLength({ max: config.POST_TITLE_MAX_LENGTH }),
    body("newContent").exists().notEmpty().isString().trim().isLength({ max: config.POST_CONTENT_MAX_LENGTH }),
    body("newKeywords").exists().isArray({ max: config.POST_KEYWORDS_MAX_LENGTH }).customSanitizer(value => value.filter(Boolean).map(kw => kw.toLowerCase().trim())),
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

router.delete("/api/v1/delete/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async function (req, res) {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;
    await session.withTransaction(async () => {
        const deletePostResult = await schemas.Posts.deleteOne(hotQueries.modify_post(id, req.session.userId), { session });
        if (deletePostResult.deletedCount === 0) throw new ClientError("You may not have access to this post!");

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

export default router;