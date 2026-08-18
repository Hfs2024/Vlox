const schemas = require("./schemas.js");
const { checkAuth, createErrorMessage, checkValidID, hotQueries } = require("./helpers.js");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

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
            query = { ...hotQueries.find_user_unforked_post(id, req.session.userId), pinned: false }
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

// Pin and unpin
router.post("/api/v1/pin/post/:id", checkAuth, checkValidID, async function (req, res) {
    const session = await mongoose.startSession();

    try {
        let { value } = req.body;
        const id = req.params.id;
        value = value ? true : false; // Force a boolean!

        await session.withTransaction(async () => {
            // Save
            const postUpdate = await schemas.Posts.updateOne({
                ...hotQueries.find_user_unforked_post(id, req.session.userId),
                private: false,
                pinned: value ? false : true // Opposite!
            }, { pinned: value }, { session });
            if (postUpdate.matchedCount === 0) throw new Error("POST_UPDATE_FAILED");

            // Inc
            const userFindQuery = { _id: req.session.userId }
            if (value) userFindQuery.pinnedPostsCount = { $lt: 10 };

            const userUpdate = await schemas.Users.updateOne(userFindQuery, {
                $inc: {
                    pinnedPostsCount: value ? 1 : -1
                }
            }, { session });

            if (userUpdate.matchedCount === 0) throw new Error("USER_UPDATE_FAILED");
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.message === "POST_UPDATE_FAILED") return res.status(400).json({ error: "Seems this isn't your post!" });
        if (e.message === "USER_UPDATE_FAILED") return res.status(400).json({ error: "Seems you have more than 10 pinned posts!" });
        console.error("Failed To Pin/Unpin Post: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Something went wrong. Try again." });
    } finally {
        session.endSession();
    }
});

// Create comment
router.post("/api/v1/comment/post/:id", checkAuth, checkValidID, async (req, res) => {
    const session = await mongoose.startSession();

    try {
        let { comment } = req.body;
        const id = req.params.id;
        comment = String(comment).trim();
        if (!comment) return res.status(400).json({ error: "You didn't enter a comment!" });
        if (comment.length > 200) return res.status(400).json({ error: "Comment cannot exceed 200 characters!" });

        await session.withTransaction(async () => {
            // Insert comment
            const newComment = new schemas.Comments({
                content: comment,
                for: id,
                by: req.session.userId,
                rootId: null
            });

            await newComment.save({ session });

            // Inc comments
            const result = await schemas.Posts.updateOne(hotQueries.find_user_post(id, req.session.userId), {
                $inc: {
                    comments: 1
                }
            }, { session });

            if (result.matchedCount === 0) throw new Error("COMMENT_UPDATE_FAILED");
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.message === "COMMENT_UPDATE_FAILED") return res.status(400).json({ error: "Seems you don't have permission to comment on this post!" });
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Server Error" });
    } finally {
        await session.endSession();
    }
});

// Create reply
router.post("/api/v1/reply/comment/post/:id", checkAuth, checkValidID, async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const id = req.params.id;
        let { reply, rootId } = req.body;
        reply = String(reply).trim();
        if (!reply) return res.status(400).json({ error: "Reply can't be empty!" });
        if (reply.length > 200) return res.status(400).json({ error: "Reply cannot exceed 200 chars!" });

        await session.withTransaction(async () => {
            // Find post
            const post = await schemas.Posts.findOne(hotQueries.find_user_post(id, req.session.userId));
            if (!post) throw new Error("POST_NOT_FOUND");

            // Add reply
            const newReply = new schemas.Comments({
                content: reply,
                rootId: rootId,
                for: id,
                by: req.session.userId
            });

            await newReply.save({ session });

            // Inc comments
            const result = await schemas.Comments.updateOne({
                _id: rootId,
                for: id,
                repliesCount: { $lt: 10 }
            }, {
                $inc: {
                    repliesCount: 1
                }
            }, { session });

            if (result.matchedCount === 0) throw new Error("COMMENT_UPDATE_FAILED");
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.message === "POST_NOT_FOUND") return res.status(400).json({ error: "Post not found or you don't have permissions to see it!" });
        if (e.message === "COMMENT_UPDATE_FAILED") return res.status(400).json({ error: "You can't reply to this comment!" });
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(400).json({ error: "Server error" });
    } finally {
        await session.endSession();
    }
});

// Fork post
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

// Redeem post
router.post("/api/v1/redeem/post/:id", checkAuth, checkValidID, async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const remaining = 4000 - req.currentUser.maxPostContentCharsLength;
        let inc = 100;
        if (remaining < 100) inc = remaining;
        const id = req.params.id;

        await session.withTransaction(async () => {
            const postResult = await schemas.Posts.updateOne({
                ...hotQueries.find_user_unforked_post(id, req.session.userId),
                likes: { $gte: 100 },
                redeemed: false,
            }, {
                $set: {
                    redeemed: true
                }
            }, { session });

            if (postResult.matchedCount === 0) throw new Error("POST_UPDATE_FAILED");

            const userResult = await schemas.Users.updateOne({
                _id: req.session.userId,
                maxPostContentCharsLength: { $lt: 4000 }
            }, {
                $inc: {
                    maxPostContentCharsLength: inc
                }
            }, { session });

            if (userResult.matchedCount === 0) throw new Error("USER_UPDATE_FAILED");
        });

        return res.status(200).json({ success: true, inc: inc });
    } catch (e) {
        if (["POST_UPDATE_FAILED", "USER_UPDATE_FAILED"].includes(e.message)) return res.status(400).json({ error: "Could not redeem post. Try again later." });
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to redeem. Try again later." });
    } finally {
        await session.endSession();
    }
});

// Likes/Report post
router.post("/api/v1/react/:action/post/:id", checkAuth, checkValidID, async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const action = req.params.action;
        const id = req.params.id;
        if (!["like", "report"].includes(action)) return res.status(400).json({ error: "Invalid action type. Try again." });

        await session.withTransaction(async () => {
            const newReaction = new schemas.Reactions({
                by: req.session.userId,
                for: id,
                type: action
            });

            await newReaction.save({ session });

            const result = await schemas.Posts.updateOne(hotQueries.find_user_post(id, req.session.userId),
                {
                    $inc: {
                        likes: action === "like" ? 1 : 0,
                        reports: action === "report" ? 1 : 0
                    }
                }, {
                session
            });

            if (result.matchedCount === 0) throw new Error("POST_UPDATE_FAILED");
        });
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: "You already did this action!" });
        if (e.message === "POST_UPDATE_FAILED") return res.status(400).json({ error: "Post not found!" });
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Server error. Try again later." });
    } finally {
        await session.endSession()
    }
});

// Edit comment
router.put("/api/v1/edit/post/comment/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        let { newComment, commentId } = req.body;
        newComment = String(newComment).trim();
        if (!newComment) return res.status(400).json({ error: "Comment content cannot be empty." });
        if (newComment.length > 200) return res.status(400).json({ error: "Comment cannot exceed 200 characters" });
        const id = req.params.id;
        const post = await schemas.Posts.findOne(hotQueries.find_user_post(id, req.session.userId));
        if (!post) return res.status(400).json({ error: "Post not found or you don't have permission to access!" });

        const result = await schemas.Comments.updateOne({
            for: id,
            _id: commentId,
            by: req.session.userId
        }, {
            $set: {
                content: newComment
            }
        });

        if (!result) return res.status(400).json({ error: "Comment not found or it's not your comment!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to update comment. Try again." });
    }
});

// Edit post
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

        const result = await schemas.Posts.updateOne(hotQueries.find_user_unforked_post(id, req.session.userId), {
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

// Delete post and forks
router.delete("/api/v1/delete/post/:id", checkAuth, checkValidID, async function (req, res) {
    const session = await mongoose.startSession();

    try {
        const id = req.params.id;
        await session.withTransaction(async () => {
            const result = await schemas.Posts.deleteOne(hotQueries.find_user_unforked_post(id, req.session.userId), { session });
            if (result.deletedCount === 0) throw new Error("POST_DELETE_FAILED");

            await schemas.Users.updateOne({
                _id: req.session.userId,
            }, {
                $inc: {
                    pinnedPostsCount: -1
                }
            }, { session });

            await schemas.Reactions.deleteMany({
                for: id
            }, { session });
            await schemas.Comments.deleteMany({
                for: id
            }, { session });
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.message === "POST_DELETE_FAILED") return res.status(400).json({ error: "Post not found!" });
        console.error(`Delete Post Failue: ${e.message}.`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to delete post. Try again." });
    } finally {
        await session.endSession();
    }
});

router.delete("/api/v1/delete/fork/:id", checkAuth, async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const id = req.params.id;
        await session.withTransaction(async () => {
            const result = await schemas.Posts.deleteOne({
                _id: id,
                $or: [
                    { forkerId: req.session.userId },
                    { receiverId: req.session.userId }
                ] // Are you the receiver or the forker of the post?
            }, { session });

            if (result.deletedCount === 0) throw new Error("FORK_DELETE_FAILED");

            await schemas.Reactions.deleteMany({
                for: id
            });
            await schemas.Comments.deleteMany({
                for: id
            });
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        if (e.message === "FORK_DELETE_FAILED") return res.status(400).json({ error: "Fork not found!" });
        console.error(`Delete Fork Failue: ${e.message}.`);
        createErrorMessage(e, req.session.userId, req.originalUrl);
        return res.status(500).json({ error: "Failed to delete fork. Try again." });
    } finally {
        await session.endSession();
    }
});

module.exports = {
    router
}