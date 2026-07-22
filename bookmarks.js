const schemas = require("./schemas.js");
const express = require("express");
const { checkAuth, createErrorMessage, checkValidID, cleanData } = require("./helpers.js");
const router = express.Router();

// Post, delete and put routes
router.post("/api/get/bookmarks/posts", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        const bookmarks = await schemas.Bookmarks.find({
            by: req.currentUser.username
        }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(10).select("postId");
        const ids = bookmarks.map(bookmark => bookmark.postId.toString());
        const bookmarksPosts = await schemas.Posts.find({ 
            _id: { $in: ids }, 
            private: false 
        }).populate("by", "-password -recoveryCodes -pinnedPosts -email -pinnedPostsCount").lean(); 

        return res.status(200).json({ success: true, posts: bookmarksPosts });
    } catch (e) {
        console.error("Fetch Bookmarks Break: ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Could not retrieve bookmark posts" });
    }
});

router.post("/api/v1/bookmark/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const isValidPost = await schemas.Posts.findOne({ _id: id, private: false });
        if (!isValidPost) return res.status(400).json({ error: "Post not found!" });

        const newBookmark = new schemas.Bookmarks({
            postId: id,
            by: req.currentUser.username,
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
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: "You didn't enter a title!" });
        const cleanedPayload = cleanData({ title });

        const result = await schemas.Bookmarks.updateOne({
            _id: id,
            by: req.currentUser.username // Is this your bookmark?
        }, {
            $set: {
                title: cleanedPayload.title
            }
        }, {
            new: true
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
            by: req.currentUser.username // Is this your bookmark?
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