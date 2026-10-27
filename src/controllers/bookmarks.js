import express from "express";
import { checkAuth } from "../utils.js";
import schemas from "../schemas.js";
import config from "../../config/backend.js";
import {
    getBookmarksValidator,
    defaultPostFindValidator,
    renameBookmarkValidator,
    deleteBookmarkValidator
} from "../validators.js";
const router = express.Router();

router.post("/bookmarks", checkAuth, getBookmarksValidator, async (req, res) => {
    const skip = req.cleanData.skip;
    const bookmarks = await schemas.Bookmarks.find({
        by: req.session.userId
    })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(config.BOOKMARKS_LIMIT)
        .lean();

    return res.status(200).json({ success: true, bookmarks: bookmarks });
});

router.post("/bookmarks/:id", checkAuth, defaultPostFindValidator, async (req, res) => {
    const id = req.cleanData.id;
    const post = await schemas.Posts.findOne({ _id: id, private: false })
        .select("title")
        .lean();

    if (!post) return res.status(400).json({ error: "Post not found!" });

    // Insert bookmark
    const newBookmark = new schemas.Bookmarks({
        for: id,
        by: req.session.userId,
        title: post.title
    });

    await newBookmark.save();
    return res.status(200).json({ success: true });
});

router.put("/bookmarks/:id/rename", checkAuth, renameBookmarkValidator, async (req, res) => {
    const { id, title } = req.cleanData;
    const now = new Date();
    
    const result = await schemas.Bookmarks.updateOne({
        _id: id,
        by: req.session.userId
    }, [
        {
            $set: {
                title: {
                    $cond: [{ $eq: ["$title", title] }, "$title", title]
                },

                updatedAt: {
                    $cond: [{ $eq: ["$title", title] }, "$updatedAt", now]
                }
            }
        }
    ], {
        timestamps: false
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Bookmark not found!" });

    return res.status(200).json({
        changed: result.modifiedCount !== 0,
        success: true
    });
});

router.delete("/bookmarks/:id/delete", checkAuth, deleteBookmarkValidator, async (req, res) => {
    const id = req.cleanData.id;
    const result = await schemas.Bookmarks.deleteOne({
        _id: id,
        by: req.session.userId
    });

    if (result.deletedCount === 0) return res.status(400).json({ error: "Bookmark not found!" });
    return res.status(200).json({ success: true });
});

export default router;