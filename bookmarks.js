const schemas = require("./schemas.js");
const express = require("express");
const { body, param, query } = require("express-validator");
const { checkAuth, validateResult } = require("./helpers.js");
const router = express.Router();

// Post, delete and put routes
router.post("/api/v1/get/bookmarks", checkAuth, [
    query("skip").exists().isInt({ min: 0 })
], validateResult, async (req, res) => {
    try {
        const skip = req.cleanData.skip;
        const bookmarks = await schemas.Bookmarks.find({
            by: req.session.userId
        })
            .sort({ createdAt: -1, _id: -1 })
            .skip(parseInt(skip))
            .limit(10)
            .lean();

        return res.status(200).json({ success: true, posts: bookmarks });
    } catch (e) {
        console.error("Fetch Bookmarks Break: ", e.message);
        return res.status(500).json({ error: "Could not retrieve bookmark posts" });
    }
});

router.post("/api/v1/bookmark/post/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    try {
        const id = req.cleanData.id;
        const isValidPost = await schemas.Posts.findOne({
            _id: id,
            private: false,
            forkerId: null,
            receiverId: null
        });
        if (!isValidPost) return res.status(400).json({ error: "Post not found!" });

        const newBookmark = new schemas.Bookmarks({
            for: id,
            by: req.session.userId,
            title: isValidPost.title
        })

        await newBookmark.save();
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Bookmark Post Failue: ${e.message}.`);
        return res.status(500).json({ error: "You already bookmarked this post!" });
    }
});

router.put("/api/v1/rename/bookmark/:id", checkAuth, [
    param("id").exists().isMongoId(),
    body("title").exists().notEmpty().isString().isLength({ max: 20 }).trim()
], validateResult, async (req, res) => {
    try {
        const { id, title } = req.cleanData;

        const result = await schemas.Bookmarks.updateOne({
            _id: id,
            by: req.session.userId // Is this your bookmark?
        }, {
            $set: {
                title: title
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Bookmark not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Bookmark Rename Failue: ${e.message}.`);
        return res.status(500).json({ error: "Could not rename bookmark. Try again." });
    }
});

router.delete("/api/v1/delete/bookmark/:id", checkAuth, [
    param("id").exists().isMongoId()
], validateResult, async (req, res) => {
    try {
        const id = req.cleanData.id;
        const result = await schemas.Bookmarks.deleteOne({
            _id: id,
            by: req.session.userId, // Is this your bookmark?
        });

        if (result.deletedCount === 0) return res.status(400).json({ error: "Bookmark not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Bookmark Delete Failue: ${e.message}.`);
        return res.status(500).json({ error: "Could not delete bookmark. Try again." });
    }
});

module.exports = {
    router
}