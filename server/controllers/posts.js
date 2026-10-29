import schemas from "../core/schemas.js";
import { checkAuth, ClientError, postQueries } from "../core/utils.js";
import errors from "../../shared/errors.js";
import express from "express";
import mongoose from "mongoose";
import {
    changePostVisibilityValidator,
    editPostsValidator,
    defaultPostFindValidator,
    commentsValidator,
    editCommentValidator
} from "../core/validators.js";
const router = express.Router();

router.put("/posts/:id/visibility", checkAuth, changePostVisibilityValidator, async (req, res) => {
    const { id, value } = req.cleanData;
    const now = new Date();

    const result = await schemas.Posts.updateOne(postQueries.modify_post(id, req.session.userId), [
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
        timestamps: false
    });

    if (result.matchedCount === 0) return res.status(404).json({ error: errors.NOT_FOUND("Post") });

    return res.status(200).json({
        changed: result.modifiedCount !== 0,
        success: true
    });
});

router.post("/posts/:id/like", checkAuth, defaultPostFindValidator, async (req, res) => {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;

    await session.withTransaction(async () => {
        const result = await schemas.Posts.updateOne(postQueries.view_post(id, req.session.userId),
            {
                $inc: {
                    likes: 1
                }
            }, {
            session
        });

        if (result.matchedCount === 0) throw new ClientError(errors.POST_ACCESS_DENIED());

        await schemas.Likes.create([{ by: req.session.userId, for: id }], { session });
    });

    await session.endSession();
    return res.status(201).json({ success: true });
});

router.put("/posts/:id/update", checkAuth, editPostsValidator, async (req, res) => {
    const { content, title, id } = req.cleanData;
    const now = new Date();

    const result = await schemas.Posts.updateOne(postQueries.modify_post(id, req.session.userId), [
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
        timestamps: false
    });

    if (result.matchedCount === 0) return res.status(404).json({ error: errors.NOT_FOUND("Post") });

    return res.status(200).json({
        changed: result.modifiedCount !== 0,
        success: true
    });
});

router.delete("/posts/:id/delete", checkAuth, defaultPostFindValidator, async function (req, res) {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;

    await session.withTransaction(async () => {
        const result = await schemas.Posts.deleteOne(postQueries.modify_post(id, req.session.userId), { session });
        if (result.deletedCount === 0) throw new ClientError(errors.POST_ACCESS_DENIED());

        await schemas.Likes.deleteMany({ for: id }, { session });
        await schemas.Comments.deleteMany({ for: id }, { session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

router.post("/posts/:id/comments", checkAuth, commentsValidator, async (req, res) => {
    const { id, content } = req.cleanData;
    const post = await schemas.Posts.exists(postQueries.view_post(id, req.session.userId));
    if (!post) return res.status(404).json({ error: errors.NOT_FOUND("Post") });

    await schemas.Comments.create({ content, for: id, by: req.session.userId });
    return res.status(201).json({ success: true });
});

router.put("/comments/:id/update", checkAuth, editCommentValidator, async (req, res) => {
    const { id, content } = req.cleanData;
    const now = new Date();

    const result = await schemas.Comments.updateOne({
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
        ], {
        timestamps: false
    });

    if (result.matchedCount === 0) return res.status(404).json({ error: errors.NOT_FOUND("Comment") });

    return res.status(200).json({
        changed: result.modifiedCount !== 0,
        success: true
    });
});

export default router;