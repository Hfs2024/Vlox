const schemas = require("./schemas.js");
const { checkAuth, createErrorMessage, checkValidID } = require("./helpers.js");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// User and posts
// Change visibility
router.post("/api/v1/change-visibility/:item/", checkAuth, async (req, res) => {
    try {
        const id = req.query.id;
        const item = req.params.item;
        const { value } = req.body;
        let query = {};
        const modelToUpdate = item === "post" ? "Posts" : item === "user-profile" ? "Users" : "";
        if (!modelToUpdate) return res.status(400).json({ error: "Unknown model. Try again." });
        if (modelToUpdate === "Posts") {
            if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: "This ID is not valid!" });
            const isPinned = await schemas.Users.findOne({ username: req.currentUser.username, pinnedPosts: id });
            if (isPinned) return res.status(400).json({ error: "You can't make a pinned post private! Unpin it first!" });
            query = {
                by: req.session.userId,
                _id: id,
                forkerId: null,
                receiverId: null
            };
        }
        if (modelToUpdate === "Users") query._id = req.session.userId;

        const result = await schemas[modelToUpdate]?.updateOne(query, {
            $set: {
                private: value ? true : false
            }
        });

        if (result?.matchedCount === 0) return res.status(400).json({ error: "Something went wrong. Try again." });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to change visibility. Try again." });
    }
});

// Posts 
// Pin and unpin
router.post("/api/v1/pin/post/:id", checkAuth, checkValidID, async function (req, res) {
    try {
        const id = req.params.id;
        const isUserPost = await schemas.Posts.findOne({
            _id: id,
            by: req.session.userId,
            private: false,
            forkerId: null,
            receiverId: null
        });
        if (!isUserPost) return res.status(400).json({ error: "Seems like this is not your post!" });

        const result = await schemas.Users.updateOne({
            username: req.currentUser.username,
            pinnedPostsCount: { $lt: 10 }
        }, {
            $push: {
                pinnedPosts: id
            },

            $inc: {
                pinnedPostsCount: 1
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Seems you have more than 10 pinned posts!" })

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
        const result = await schemas.Users.updateOne({
            username: req.currentUser.username,
            pinnedPosts: id,
            pinnedPostsCount: { $gt: 0 }
        }, {
            $pull: {
                pinnedPosts: id
            },

            $inc: {
                pinnedPostsCount: -1
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Seems this post wasn't pinned!" });

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error("Failed To Unpin Post ", e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Something went wrong. Try again." });
    }
});

// Delete post and forks
router.delete("/api/v1/delete/post/:id", checkAuth, checkValidID, async function (req, res) {
    try {
        const id = req.params.id;
        const result = await schemas.Posts.deleteOne({
            _id: id,
            by: req.session.userId, // Is this your post?
            receiverId: null,
            forkerId: null
        });

        if (result.deletedCount === 0) return res.status(404).json({ error: "Post not found!" });
        await schemas.Users.updateOne({
            username: req.currentUser.username,
            pinnedPosts: id
        }, {
            $inc: {
                pinnedPostsCount: -1
            },

            $pull: {
                pinnedPosts: id
            }
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

router.delete("/api/v1/delete/fork/:id", checkAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const result = await schemas.Posts.deleteOne({
            _id: id,
            $or: [
                { forkerId: req.session.userId },
                { receiverId: req.session.userId }
            ] // Are you the receiver or the forker of the post?
        });

        if (result.deletedCount === 0) return res.status(404).json({ error: "Post not found!" });;
        await schemas.Reactions.deleteMany({
            for: id
        });
        await schemas.Comments.deleteMany({
            for: id
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error(`Delete Fork Failue: ${e.message}.`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to delete fork. Try again." });
    }
});

// Create comment
router.post("/api/v1/comment/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        let { comment } = req.body;
        const id = req.params.id;
        comment = String(comment).trim();
        if (!comment) return res.status(400).json({ error: "You didn't enter a comment!" });
        if (comment.length > 200) return res.status(400).json({ error: "Comment cannot exceed 200 characters!" });

        const newComment = new schemas.Comments({
            content: comment,
            for: id,
            by: req.session.userId
        });

        await newComment.save();

        const result = await schemas.Posts.updateOne({
            _id: id,
            $or: [
                {
                    forkerId: null,
                    receiverId: null,
                    private: false
                },
                {
                    $or: [
                        { forkerId: req.session.userId },
                        { receiverId: req.session.userId }
                    ],
                }
            ]
        },
            {
                $inc: {
                    comments: 1
                }
            });

        if (result.matchedCount === 0) {
            await schemas.Comments.deleteOne({
                for: id,
                by: req.session.userId,
                _id: newComment._id
            });

            return res.status(400).json({ error: "Post not found or you don't have permission to comment." });
        }

        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Server Error" });
    }
});

// Edit comment
router.put("/api/v1/edit/post/comment/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        let { newComment } = req.body;
        newComment = String(newComment).trim();
        if (!newComment) return res.status(400).json({ error: "Comment content cannot be empty." });
        if (newComment.length > 200) return res.status(400).json({ error: "Comment cannot exceed 200 characters" });
        const id = req.params.id;
        const comment = await schemas.Comments.findOne({
            _id: id,
            by: req.session.userId
        });

        if (!comment) return res.status(400).json({ error: "Comment not found or it's not your comment!" });
        const postExists = await schemas.Posts.findOne({
            _id: comment.for,
            $or: [
                {
                    forkerId: null,
                    receiverId: null,
                    private: false
                },
                {
                    $or: [
                        { forkerId: req.session.userId },
                        { receiverId: req.session.userId }
                    ],
                }
            ]
        });

        if (!postExists) return res.status(400).json({ error: "Post not found or you don't have permission!" });
        const result = await schemas.Comments.findOneAndUpdate({
            _id: id,
            by: req.session.userId
        }, {
            $set: {
                content: newComment
            }
        }, {
            new: true
        });

        if (!result) return res.status(400).json({ error: "Comment not found or it's not your comment!" });
        return res.status(200).json({ success: true, updatedDoc: result });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to update comment. Try again." });
    }
});

// Edit
router.put("/api/v1/edit/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        let { newContent, newTitle, newKeywords, newSpoilers } = req.body;
        const id = req.params.id;
        newContent = String(newContent).trim();
        newTitle = String(newTitle).trim();
        newKeywords = newKeywords?.filter(Boolean)?.map(kw => kw.toLowerCase().trim()); // You give me a falsy value? Say goodbye to it
        if (!newContent || !newTitle) return res.status(400).json({ error: "You must enter a title and content!" });
        if (newTitle.length > 20) return res.status(400).json({ error: "Title cannot exceed 20 chars!" });
        if (newContent.length > req.currentUser.maxPostContentCharsLength) return res.status(400).json({ error: `Content cannot exceed ${req.currentUser.maxPostContentCharsLength} characters!` });

        const result = await schemas.Posts.updateOne({
            _id: id,
            by: req.session.userId,
            receiverId: null,
            forkerId: null
        }, {
            $set: {
                content: newContent,
                title: newTitle,
                keywords: (Array.isArray(newKeywords) && newKeywords.length <= 5) ? newKeywords : [],
                spoilers: newSpoilers ? true : false
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to update. Try again later." });
    }
});

// Redeem 
router.post("/api/v1/redeem/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        if (req.currentUser.maxPostContentCharsLength >= 4000) return res.status(400).json({ error: "Seems you have the max post chars content!" });
        const remaining = 4000 - req.currentUser.maxPostContentCharsLength;
        let inc = 100;
        if (remaining < 100) inc = remaining;

        const id = req.params.id;
        const postResult = await schemas.Posts.updateOne({
            _id: id,
            likes: { $gte: 100 },
            redeemed: false,
            by: req.session.userId,
            receiverId: null,
            forkerId: null
        }, {
            $set: {
                redeemed: true
            }
        });

        if (postResult.matchedCount === 0) return res.status(400).json({ error: "Still needs more likes or already redeemed!" });
        else {
            const userResult = await schemas.Users.updateOne({
                username: req.currentUser.username,
                maxPostContentCharsLength: { $lt: 4000 }
            }, {
                $inc: {
                    maxPostContentCharsLength: inc
                }
            });

            if (userResult.matchedCount === 0) {
                await schemas.Posts.updateOne({ _id: id, by: req.session.userId, redeemed: true }, { $set: { redeemed: false } });
                return res.status(400).json({ error: "Could not apply reward. Limit reached. You can still redeem later." });
            }
        }

        return res.status(200).json({ success: true, inc: inc });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to redeem. Try again later." });
    }
});

// Fork
router.post("/api/v1/fork/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const { receiverId } = req.body;
        // Does the user and post exist?
        const user = await schemas.Users.findOne({ username: receiverId, private: false }); // All private accounts can't be a fork receiver
        if (!user) return res.status(400).json({ error: "User not found" });
        if (user.username === req.currentUser.username) return res.status(400).json({ error: "You can't chat with yourself 😅" });
        const post = await schemas.Posts.findOne({ _id: id, boosted: false, private: false, receiverId: null, forkerId: null }); // All boosted/private posts can't be forked
        if (!post) return res.status(400).json({ error: "Post not found!" });

        // Fork
        const newPost = new schemas.Posts({
            title: post.title,
            content: post.content,
            by: post.by,
            receiverId: user._id,
            forkerId: req.session.userId,
            rootId: post._id
        });

        await newPost.save();
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: "You already forked this post with this user!" });
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Sever error. Try again later." });
    }
});

// Likes and reports
router.post("/api/v1/:action/post/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const action = req.params.action;
        const id = req.params.id;
        if (!["like", "report"].includes(action)) return res.status(400).json({ error: "Invalid action type. Try again." });

        // Create the reaction
        const newReaction = new schemas.Reactions({
            by: req.currentUser.username,
            for: id,
            type: action
        });

        await newReaction.save();

        const result = await schemas.Posts.updateOne({
            _id: id,
            $or: [
                {
                    forkerId: null,
                    receiverId: null,
                    private: false
                },
                {
                    $or: [
                        { forkerId: req.session.userId },
                        { receiverId: req.session.userId }
                    ],
                }
            ]
        },
            {
                $inc: {
                    likes: action === "like" ? 1 : 0,
                    reports: action === "report" ? 1 : 0
                }
            });

        // Nothing found? Delete the reaction
        if (result.matchedCount === 0) {
            await schemas.Reactions.deleteOne({
                by: req.currentUser.username,
                for: id,
                type: action
            });

            return res.status(404).json({ error: "Post not found." });
        }

        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: "You already did this action!" });
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Server error. Try again later." });
    }
});

module.exports = {
    router
}