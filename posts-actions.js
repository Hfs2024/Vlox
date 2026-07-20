const schemas = require("./schemas.js");
const { checkAuth, createErrorMessage, checkValidID, cleanData } = require("./helpers.js");
const express = require("express");
const router = express.Router();

// Pin and unpin
router.post("/api/v1/pin/post/:id", checkAuth, checkValidID, async function (req, res) {
    try {
        const id = req.params.id;
        const isUserPost = await schemas.Posts.findOne({ _id: id, by: req.session.userId, private: false });
        if (!isUserPost) return res.status(400).json({ error: "Seems like this is not your post!" });

        const result = await schemas.Users.findOneAndUpdate({
            username: req.currentUser.username,
            pinnedPostsCount: { $lt: 10 }
        }, {
            $push: {
                pinnedPosts: id
            },

            $inc: {
                pinnedPostsCount: 1
            }
        }, {
            new: true
        });

        if (!result) return res.status(400).json({ error: "Seems you have more than 10 pinned posts!" })

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error("Failed To Pin Post: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Something went wrong. Try again." });
    }
});

router.post("/api/v1/unpin/post/:id", checkAuth, checkValidID, async function (req, res) {
    try {
        const id = req.params.id;
        const result = await schemas.Users.findOneAndUpdate({
            username: req.currentUser.username
        }, {
            $pull: {
                pinnedPosts: id
            },

            $inc: {
                pinnedPostsCount: -1
            }
        }, {
            new: true
        });

        if (!result) return res.status(400).json({ error: "Seems this post wasn't pinned!" });

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error("Failed To Unpin Post ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Something went wrong. Try again." });
    }
});

router.post("/api/get/user-pinned-posts", checkAuth, async (req, res) => {
    try {
        const ids = req.body.ids;
        if (!Array.isArray(ids)) return res.status(400).json({ erorr: "Invalid request. 'ids' must be a type of array" });
        const postPromises = ids.map(id => schemas.Posts.findOne({ _id: id, private: false }).lean());
        const pinnedPosts = await Promise.all(postPromises);

        return res.status(200).json({ success: true, foundPinnedPosts: pinnedPosts });
    } catch (e) {
        console.error("Failed To Get Pinned Post ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Something went wrong. Try again." });
    }
});

// Delete 
router.delete("/api/v1/delete/post/:id", checkAuth, checkValidID, async function (req, res) {
    try {
        const id = req.params.id;
        const result = await schemas.Posts.findOneAndDelete({
            _id: id,
            by: req.session.userId // Is this your post? 
        });

        if (!result) return res.status(404).json({ error: "Post not found!" });
        await schemas.Users.findOneAndUpdate({
            username: req.currentUser.username,
            pinnedPosts: id
        }, {
            $inc: {
                pinnedPostsCount: -1
            },

            $pull: {
                pinnedPosts: id
            }
        }, {
            new: true
        });

        await schemas.Reactions.deleteMany({
            for: id
        });
        await schemas.Comments.deleteMany({
            for: id
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Delete Post Failue: ${e.message}.`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to delete post. Try again." });
    }
});

// Comment
router.post("/api/v1/comment/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const { comment } = req.body;
        const id = req.params.id;
        if (!comment) return res.status(400).json({ error: "You didn't enter a comment!" });
        if (comment.length > 200) return res.status(400).json({ error: "Comment cannot exceed 200 characters!" });

        const cleanedPayload = cleanData({ comment });
        const newComment = new schemas.Comments({
            content: cleanedPayload.comment,
            for: id,
            by: req.session.userId
        });

        await newComment.save();

        const result = await schemas.Posts.findOneAndUpdate({
            _id: id,
            private: false // If this was true, the comment will be removed
        },
            {
                $inc: {
                    comments: 1
                }
            },
            {
                new: true
            }
        );

        if (!result) {
            await schemas.Comments.findOneAndDelete({
                for: id,
                by: req.currentUser.username,
                content: comment
            });

            return res.status(400).json({ error: "Post not found." });
        }

        return res.status(200).json({ success: true, comments: result.comments });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Server Error" });
    }
});

// Edit comment
router.put("/api/v1/edit/post/comment/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const { newComment } = req.body;
        if (!newComment.trim()) return res.status(400).json({ error: "Comment content cannot be empty." });
        if (newComment.length > 200) return res.status(400).json({ error: "Comment cannot exceed 200 characters" });
        const cleanedPayload = cleanData({ newComment })
        const id = req.params.id;
        const result = await schemas.Comments.findOneAndUpdate({
            _id: id,
            by: req.session.userId
        }, {
            $set: {
                content: cleanedPayload.newComment
            }
        }, {
            new: true
        });

        if (!result) return res.status(400).json({ error: "Comment not found or it's not your comment!" });
        return res.status(200).json({ success: true, updatedDoc: result });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to create comment. Try again." });
    }
});

// Edit
router.put("/api/v1/edit/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const { newContent } = req.body;
        const id = req.params.id;
        if (!newContent) return res.status(400).json({ error: "You any content!" });
        if (newContent.length > 2000) return res.status(400).json({ error: "Content cannot exceed 2000 characters!" });

        const cleanedPayload = cleanData({ newContent });
        const result = await schemas.Posts.findOneAndUpdate({
            _id: id,
            by: req.session.userId
        }, {
            $set: {
                content: cleanedPayload.newContent
            }
        }, {
            new: true
        });

        if (!result) return res.status(400).json({ error: "Post not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to update. Try again later." });
    }
});

// Set visibility
router.post("/api/v1/set-visibility/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const { value } = req.body;
        const isPinned = await schemas.Users.findOne({ username: req.currentUser.username, pinnedPosts: id });
        if (isPinned) return res.status(400).json({ error: "You can't make a pinned post private! Unpin it first!" });

        const result = await schemas.Posts.findOneAndUpdate({
            _id: id,
            by: req.session.userId
        }, {
            $set: {
                private: value ? true : false
            }
        }, {
            new: true
        });

        if (!result) return res.status(400).json({ error: "Post not found or this isn't your post!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to change post visibility. Try again." });
    }
});

// Likes and reports
router.post("/api/v1/:action/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const action = req.params.action;
        const id = req.params.id;
        if (!["like", "report"].includes(action)) return res.status(400).json({ error: "Invalid type" });

        // Create the reaction
        let newReaction = new schemas.Reactions({
            by: req.currentUser.username,
            for: id,
            type: action
        });

        await newReaction.save();

        // Update the post
        let result = await schemas.Posts.findOneAndUpdate({
            _id: id,
            private: false
        },
            {
                $inc: {
                    likes: action === "like" ? 1 : 0,
                    reports: action === "report" ? 1 : 0
                }
            },
            {
                new: true
            }
        );

        // Nothing found? Delete the reaction
        if (!result) {
            await schemas.Reactions.findOneAndDelete({
                by: req.currentUser.username,
                for: id,
                type: action
            });

            return res.status(404).json({ error: "Post not found." });
        }

        return res.status(200).json({
            success: true,
            likes: result.likes,
            reports: result.reports
        });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "You already did this action!" });
    }
});

module.exports = {
    router
}