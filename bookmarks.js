const schemas = require("./schemas.js");
const express = require("express");
const { checkAuth, createErrorMessage, checkValidID } = require("./helpers.js");
const router = express.Router();

// Post, delete and put routes
router.post("/api/v1/get/bookmarks", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const bookmarks = await schemas.Bookmarks.find({
            by: req.session.userId
        })
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(10)
            .lean();

        return res.status(200).json({ success: true, posts: bookmarks });
    } catch (e) {
        console.error("Fetch Bookmarks Break: ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not retrieve bookmark posts" });
    }
});

router.post("/api/v1/bookmark/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
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
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "You already bookmarked this post!" });
    }
});

router.post("/api/v1/rename/bookmark/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        let { title } = req.body;
        title = String(title).trim();
        if (!title) return res.status(400).json({ error: "You didn't enter a title!" });
        if (title.length > 20) return res.status(400).json({ error: "Title cannot exceed 20 chars!" });

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
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not rename bookmark. Try again." });
    }
});

router.delete("/api/v1/delete/bookmark/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const result = await schemas.Bookmarks.deleteOne({
            _id: id,
            by: req.session.userId, // Is this your bookmark?
        });

        if (result.deletedCount === 0) return res.status(400).json({ error: "Bookmark not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Bookmark Delete Failue: ${e.message}.`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not delete bookmark. Try again." });
    }
});

module.exports = {
    router
}