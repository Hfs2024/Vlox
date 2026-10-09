import schemas from "./schemas.js";
import { checkAuth, postQueries, ClientError } from "./utils.js";
import express from "express";
import mongoose from "mongoose";
import config from "./config/backend.js";
import {
    changePostVisibilityValidator,
    editPostsValidator,
    defaultPostFindValidator,
    reactOnPostValidator
} from "./validators.js";
const router = express.Router();

router.put("/api/v1/update/post-visibility/:id", checkAuth, changePostVisibilityValidator, async (req, res) => {
    const { id, value } = req.cleanData;
    const result = await schemas.Posts.updateOne(postQueries.modify_post(id, req.session.userId), {
        $set: {
            private: value
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found or post is private!" });
    return res.status(200).json({ success: true });
});

router.post("/api/v1/react/:action/post/:id", checkAuth, reactOnPostValidator, async (req, res) => {
    const session = await mongoose.startSession();
    const { action, id } = req.cleanData;

    await session.withTransaction(async () => {
        const newReaction = new schemas.Reactions({
            by: req.session.userId,
            for: id,
            type: action
        });

        await newReaction.save({ session });

        const updatePostResult = await schemas.Posts.updateOne(postQueries.view_post(id, req.session.userId),
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

router.put("/api/v1/update/post/:id", checkAuth, editPostsValidator, async (req, res) => {
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

router.delete("/api/v1/delete/post/:id", checkAuth, defaultPostFindValidator, async function (req, res) {
    const session = await mongoose.startSession();
    const id = req.cleanData.id;
    await session.withTransaction(async () => {
        const deletePostResult = await schemas.Posts.deleteOne(postQueries.modify_post(id, req.session.userId), { session });
        if (deletePostResult.deletedCount === 0) throw new ClientError("You may not have access to this post!");

        await schemas.Reactions.deleteMany({
            for: id
        }, { session });
    });

    await session.endSession();
    return res.status(200).json({ success: true });
});

export default router;