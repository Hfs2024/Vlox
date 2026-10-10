import schemas from "./schemas.js";
import { checkAuth, postQueries, ClientError } from "./utils.js";
import express from "express";
import mongoose from "mongoose";
import {
    changePostVisibilityValidator,
    editPostsValidator,
    defaultPostFindValidator,
    commentsValidator
} from "./validators.js";
const router = express.Router();

router.put("/api/v1/posts/:id/visibility", checkAuth, changePostVisibilityValidator, async (req, res) => {
    const { id, value } = req.cleanData;
    const result = await schemas.Posts.updateOne(postQueries.modify_post(id, req.session.userId), {
        $set: {
            private: value
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found or post is private!" });
    return res.status(200).json({ success: true });
});

router.post("/api/v1/posts/:id/like", checkAuth, defaultPostFindValidator, async (req, res) => {
    const session = await mongoose.startSession();
    const { id } = req.cleanData;

    await session.withTransaction(async () => {
        // Update post
        const updatePostResult = await schemas.Posts.updateOne(postQueries.view_post(id, req.session.userId),
            {
                $inc: {
                    likes: 1
                }
            }, {
            session
        });

        if (updatePostResult.matchedCount === 0) throw new ClientError("You may not have access to this post!");

        // Insert like
        const newLike = new schemas.Likes({
            by: req.session.userId,
            for: id
        });

        await newLike.save({ session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.put("/api/v1/posts/:id/update", checkAuth, editPostsValidator, async (req, res) => {
    const { content, title, id, keywords } = req.cleanData;
    const result = await schemas.Posts.updateOne(postQueries.modify_post(id, req.session.userId), {
        $set: {
            content: content,
            title: title,
            keywords: keywords
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found!" });
    return res.status(200).json({ success: true });
});

router.delete("/api/v1/posts/:id/delete", checkAuth, defaultPostFindValidator, async function (req, res) {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;
    await session.withTransaction(async () => {
        const deletePostResult = await schemas.Posts.deleteOne(postQueries.modify_post(id, req.session.userId), { session });
        if (deletePostResult.deletedCount === 0) throw new ClientError("You may not have access to this post!");

        await schemas.Likes.deleteMany({
            for: id
        }, { session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.post("/api/v1/posts/:id/comments", checkAuth, commentsValidator, async (req, res) => {
    const { id, content } = req.cleanData;

    // Insert comment
    const newComment = new schemas.Comments({
        content: content,
        for: id,
        by: req.session.userId
    });

    await newComment.save();
    return res.status(200).json({ success: true });
});

export default router;