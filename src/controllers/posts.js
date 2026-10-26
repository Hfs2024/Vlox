import schemas from "../schemas.js";
import { checkAuth, postQueries, ClientError } from "../utils.js";
import express from "express";
import mongoose from "mongoose";
import {
    changePostVisibilityValidator,
    editPostsValidator,
    defaultPostFindValidator,
    commentsValidator,
    editCommentValidator
} from "../validators.js";
const router = express.Router();

router.put("/posts/:id/visibility", checkAuth, changePostVisibilityValidator, async (req, res) => {
    const { id } = req.cleanData;
    const value = req.cleanData.value === true || req.cleanData.value === "true";
    const now = new Date();

    const result = await schemas.Posts.findOneAndUpdate(postQueries.modify_post(id, req.session.userId), [
        {
            $set: {
                private: {
                    $cond: [{ $eq: ["$private", value] }, "$private", value]
                },
                updatedAt: {
                    $cond: [{ $eq: ["$private", value] }, "$updatedAt", now]
                }
            }
        }
    ], {
        returnDocument: "before",
        projection: { private: 1 },
        timestamps: false
    });

    if (!result) return res.status(400).json({ error: "Post not found or post is private!" });
    return res.status(200).json({ changed: result.private !== value, success: true });
});

router.post("/posts/:id/like", checkAuth, defaultPostFindValidator, async (req, res) => {
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

router.put("/posts/:id/update", checkAuth, editPostsValidator, async (req, res) => {
    const { content, title, id } = req.cleanData;
    const now = new Date();

    const result = await schemas.Posts.findOneAndUpdate(postQueries.modify_post(id, req.session.userId), [
        {
            $set: {
                title: {
                    $cond: [{ $eq: ["$title", title] }, "$title", title]
                },
                content: {
                    $cond: [{ $eq: ["$content", content] }, "$content", content]
                },
                updatedAt: {
                    $cond: [
                        { $and: [{ $eq: ["$title", title] }, { $eq: ["$content", content] }] },
                        "$updatedAt",
                        now
                    ]
                }
            }
        }
    ], {
        returnDocument: "before",
        projection: { title: 1, content: 1 },
        timestamps: false
    });

    if (!result) return res.status(400).json({ error: "Post not found!" });

    return res.status(200).json({
        changed: result.title !== title || result.content !== content,
        success: true
    });
});

router.delete("/posts/:id/delete", checkAuth, defaultPostFindValidator, async function (req, res) {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;
    await session.withTransaction(async () => {
        const deletePostResult = await schemas.Posts.deleteOne(postQueries.modify_post(id, req.session.userId), { session });
        if (deletePostResult.deletedCount === 0) throw new ClientError("You may not have access to this post!");

        await schemas.Likes.deleteMany({ for: id }, { session });
        await schemas.Comments.deleteMany({ for: id }, { session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.post("/posts/:id/comments", checkAuth, commentsValidator, async (req, res) => {
    const { id, content } = req.cleanData;
    const post = await schemas.Posts.exists(postQueries.view_post(id, req.session.userId));
    if (!post) return res.status(400).json({ error: "Post not found!" });

    // Insert comment
    const newComment = new schemas.Comments({
        content: content,
        for: id,
        by: req.session.userId
    });

    await newComment.save();
    return res.status(200).json({ success: true });
});

router.put("/comments/:id/update", checkAuth, editCommentValidator, async (req, res) => {
    const { id, content } = req.cleanData;
    const now = new Date();

    const result = await schemas.Comments.findOneAndUpdate(
        {
            _id: id,
            by: req.session.userId
        },
        [
            {
                $set: {
                    content: {
                        $cond: [{ $eq: ["$content", content] }, "$content", content]
                    },

                    editedAt: {
                        $cond: [{ $eq: ["$content", content] }, "$editedAt", now]
                    },
                    
                    updatedAt: {
                        $cond: [{ $eq: ["$content", content] }, "$updatedAt", now]
                    }
                }
            }
        ],
        {
            returnDocument: "before",
            projection: { content: 1 },
            timestamps: false
        }
    )

    if (!result) return res.status(404).json({ error: "Comment not found!" });

    return res.status(200).json({
        changed: result.content !== content,
        success: true
    });
});

export default router;