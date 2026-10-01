import express from "express";
import { body, param, query } from "express-validator";
import { checkAuth, validateResult } from "./helpers.js";
import schemas from "./schemas.js";
import config from "./config/backend.js";
const router = express.Router();

router.post("/api/v1/get/bookmarks", checkAuth, [
    query("skip").exists().isInt({ min: 0 })
], validateResult, async (req, res) => {
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

router.post("/api/v1/bookmark/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const id = req.cleanData.id;
    const post = await schemas.Posts.findOne({ _id: id, private: false })
        .select("title")
        .lean();
    if (!post) return res.status(400).json({ error: "Post not found!" });

    const newBookmark = new schemas.Bookmarks({
        for: id,
        by: req.session.userId,
        title: post.title
    });

    await newBookmark.save();
    return res.status(200).json({ success: true });
});

router.put("/api/v1/rename/bookmark/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("title").exists().notEmpty().isString().isLength({ max: config.POST_TITLE_MAX_LENGTH }).trim()
], validateResult, async (req, res) => {
    const { id, title } = req.cleanData;

    const result = await schemas.Bookmarks.updateOne({
        _id: id,
        by: req.session.userId
    }, {
        $set: {
            title: title
        }
    });

    if (result.matchedCount === 0) return res.status(400).json({ error: "Bookmark not found!" });
    return res.status(200).json({ success: true });
});

router.delete("/api/v1/delete/bookmark/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    const id = req.cleanData.id;
    const result = await schemas.Bookmarks.deleteOne({
        _id: id,
        by: req.session.userId
    });

    if (result.deletedCount === 0) return res.status(400).json({ error: "Bookmark not found!" });
    return res.status(200).json({ success: true });
});

export default router;