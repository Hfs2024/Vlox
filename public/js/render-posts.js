import NS from "../nanoscript.min.js";
import { sendRequest, capitalizeFirstLetter, cleanHTML, generatePostLink, initAccessibility, lockEvent } from "./helpers.js";
import { inputComment, replyComment } from "./comment-helpers.js";
import { showProfile } from "./profile.js";

export const postsState = { skip: 0 };

export async function renderPosts(posts = []) {
    const postsContainer = NS("#posts-container");
    postsContainer.html("");

    // Nothing found
    if (!posts || posts.length === 0) {
        NS.createEl("div", postsContainer, {
            className: "state-nothing-found"
        }).html("<b>No posts yet. Be the first one to post!</b>");
        return;
    }

    // Posts
    posts.forEach(async post => {
        const safePost = post || {};
        const safeBy = safePost.by || {};

        // Elements
        const postCard = NS.createEl("div", postsContainer, { className: "card" });
        const postHeader = NS.createEl("div", postCard, { className: "space-between" });
        NS.createEl("h2", postHeader, { className: "overflow" }).text(safePost.title || "No title found");
        const postIconsGroup = NS.createEl("div", postHeader, { className: "center" });

        // Icons
        // Bookmark
        NS.createEl("i", postIconsGroup, { className: "fas fa-bookmark icon-post", role: "button", tabIndex: "0" })
            .on("click", (async function () {
                const bookmarkResponse = await sendRequest({
                    url: `/api/v1/bookmark/post/${safePost._id}`,
                    method: "POST"
                });

                if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
                Swal.fire("Success", "Post bookmarked!", "success");
            }));

        // Copy link
        NS.createEl("i", postIconsGroup, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" })
            .on("click", async function () {
                NS.copy({
                    text: generatePostLink(safePost._id || ""),
                    onSuccess: () => { Swal.fire("Success", "Copied!", "success") },

                    onFailure: () => { Swal.fire("Error", "Failed to copy. Try again later", "error") }
                });
            });

        // Content
        NS.createEl("div", postCard, {}).html(cleanHTML(safePost.content) || "No content found");;

        // Author
        NS.createEl("p", postCard, {
            style: "color: red; cursor: pointer",
            role: "button", tabIndex: "0"
        })
            .html(`Created by: ${safeBy.emoji || "🚀"} <span class='author-name'>${capitalizeFirstLetter(safeBy.username || "User")}</span>`)
            .on("click", async function () {
                const authorProfileData = await sendRequest({
                    url: `/api/v1/get/user-profile/${safeBy._id}/?skip=0`
                });

                if (!authorProfileData.success) return Swal.fire(authorProfileData.error);
                showProfile(authorProfileData);
            });

        // Replies
        const renderReplies = async (id) => {
            // Get replies
            const data = await sendRequest({
                url: `/api/v1/get/post/${safePost._id}/replies/${id}`
            });

            if (!data.success) return Swal.fire(data.error);
            const replies = Array.isArray(data.replies) ? data.replies : [];
            if (replies.length <= 0) return Swal.fire("No replies yet!");

            // Show replies
            Swal.fire({
                title: "Replies",
                html: "<div id='replies-container' class='scroll-postsContainer'></div>",
                confirmButtonText: "Close"
            });

            replies.forEach(reply => {
                const safeReply = reply || {};
                const safeReplyBy = safeReply.by || {};
                const replyItem = NS.createEl("div", NS("#replies-container"), { className: "comment-item space-between" });
                replyItem.html(`
<div class="center" style="gap: 5px">
  <div class="comment-item-author">
    <i class="fas fa-medal" title="Author"></i>
    ${capitalizeFirstLetter(safeReplyBy.username || "User")}:
  </div>
  <div class="reply-item-content"></div>
</div>

<div class="center comment-item-icons">
  <i class="fas fa-reply icon-post reply-btn" role="button" tabindex="0" aria-label="Reply"></i>
  <i class="fas fa-eye icon-post view-reply-btn" role="button" tabindex="0" aria-label="View reply"></i>
</div>
                    `).on("click", function (e) {
                    e.preventDefault();
                    if (safeReplyBy.username !== window?.quickInfo?.username) return;

                    inputComment("Update reply:",
                        replyItem.get(".reply-item-content").text(),
                        async (content) => {
                            const updateReplyResponse = await sendRequest({
                                url: `/api/v1/edit/post/${safePost._id}/comment/${safeReply._id}`,
                                method: "PUT",
                                body: { newComment: content }
                            });

                            if (!updateReplyResponse.success) return Swal.fire(updateReplyResponse.error);
                            Swal.fire("Success", "Reply updated!", "success");
                            replyItem.get(".reply-item-content").text(content || "No content found");
                        });
                })

                replyItem.get(".reply-item-content").text(safeReply.content || "No content found");
                replyItem.get(".reply-btn")
                    .on("click", function (e) {
                        e.stopPropagation();
                        replyComment(safePost._id, safeReply._id);
                    });
                replyItem.get(".view-reply-btn")
                    .on("click", async function (e) {
                        e.stopPropagation();
                        renderReplies(safeReply._id);
                    });
            });
        }

        // Comments
        const commentsList = NS.createEl("div", postCard, { className: "comments-list" })
            .html("<button class='show-comments-btn w-full'><i class='fas fa-comment'></i> Show Comments</button>");
        let commentsSkip = 0;

        const renderComments = async () => {
            // Get comments
            const data = await sendRequest({
                url: `/api/v1/get/post/comments/${safePost._id}/?skip=${commentsSkip}`,
            });

            if (!data.success) return Swal.fire(data.error);
            const comments = Array.isArray(data.comments) ? data.comments : [];
            if (comments.length <= 0) return Swal.fire("No comments yet!");

            // Show comments
            commentsList.html("");

            comments.forEach(comment => {
                const safeComment = comment || {};
                const safeCommentBy = safeComment.by || {};
                const commentItem = NS.createEl("div", commentsList, { className: "comment-item space-between" });
                commentItem.html(`
<div class="center" style="gap: 5px">
  <div class="comment-item-author">
    ${safeCommentBy.emoji || "🚀"}
    ${capitalizeFirstLetter(safeCommentBy.username || "User")}:
  </div>
  <div class="comment-item-content"></div>
</div>

<div class="center comment-item-icons">
  <i class="fas fa-reply icon-post reply-btn" role="button" tabindex="0" aria-label="Reply"></i>
  <i class="fas fa-eye icon-post view-reply-btn" role="button" tabindex="0" aria-label="View reply"></i>
</div>
                    `).on("click", function () {
                    if (safeCommentBy.username !== window?.quickInfo?.username) return;

                    inputComment("Update comment:",
                        commentItem.get(".comment-item-content").text(),
                        async (content) => {
                            const updateCommentResponse = await sendRequest({
                                url: `/api/v1/edit/post/${safePost._id}/comment/${safeComment._id}`,
                                method: "PUT",
                                body: { newComment: content }
                            });

                            if (!updateCommentResponse.success) return Swal.fire(updateCommentResponse.error);
                            Swal.fire("Success", "Comment updated!", "success");
                            commentItem.get(".comment-item-content").text(content || "No content found");
                        });
                });

                commentItem.get(".comment-item-content").text(safeComment.content || "No content found");
                commentItem.get(".reply-btn").on("click", function (e) {
                    e.stopPropagation();
                    replyComment(safePost._id || "", safeComment._id || "");
                });
                commentItem.get(".view-reply-btn").on("click", async function (e) {
                    e.stopPropagation();
                    renderReplies(safeComment._id || "");
                });
            });
        }

        // Comments navigation
        const commentsNavGroup = NS.createEl("div", postCard, { className: "center" });

        // Prev
        NS.createEl("button", commentsNavGroup, { className: "comments-prev" })
            .html("<i class='fa-solid fa-chevron-left'></i>")
            .on("click", async function () {
                if (commentsSkip <= 0) return;
                commentsSkip -= 10;
                renderComments();
            });

        // Next
        NS.createEl("button", commentsNavGroup, { className: "comments-next" })
            .html("<i class='fa-solid fa-chevron-right'></i>")
            .on("click", async function () {
                commentsSkip += 10;
                renderComments();
            });

        // Show comments
        postCard.get(".show-comments-btn").on("click", async function () {
            renderComments();
        });

        // Options
        const optionsDiv = NS.createEl("div", postCard, { className: "options" });

        // Like
        const likes = Number(safePost.likes ?? 0);
        const likesBtn = NS.createEl("button", optionsDiv, {}).html(`<i class="fa-solid fa-thumbs-up"></i> <span class="likes-count">${likes.toLocaleString()}</span>`);
        likesBtn.on("click", lockEvent(async function () {
            const likesResponse = await sendRequest({
                url: `/api/v1/react/like/post/${safePost._id || ""}`,
                method: "POST"
            });

            if (likesResponse.error) return Swal.fire(likesResponse.error);
            const newLikes = likes + 1;
            likesBtn.get(".likes-count").text(newLikes.toLocaleString());
        }))

        // Report
        const reports = Number(safePost.reports ?? 0);
        const reportBtn = NS.createEl("button", optionsDiv, {})
            .html(`<i class="fa-solid fa-warning"></i> <span class="reports-count">${reports.toLocaleString()}</span>`);
        reportBtn.on("click", lockEvent(async function () {
            const reportResponse = await sendRequest({
                url: `/api/v1/react/report/post/${safePost._id || ""}`,
                method: "POST"
            });

            if (!reportResponse.success) return Swal.fire(reportResponse.error);
            const newReports = reports + 1;
            reportBtn.get(".reports-count").text(newReports.toLocaleString());
        }));

        // Comment
        const commentsCount = Number(safePost.comments ?? 0);
        const commentBtn = NS.createEl("button", optionsDiv, {})
            .html(`<i class="fa-solid fa-comment"></i> <span class="comments-count">${commentsCount.toLocaleString()}</span>`);
        commentBtn.on("click", function () {
            inputComment("Add a comment:", "",
                async (content) => {
                    const commentResponse = await sendRequest({
                        url: `/api/v1/comment/post/${safePost._id || ""}`,
                        method: "POST",
                        body: { comment: content }
                    });

                    if (!commentResponse.success) return Swal.fire(commentResponse.error);
                    const commentsCounter = commentBtn.get(".comments-count");
                    const newComments = parseInt(commentsCounter.text()) + 1;
                    commentsCounter.text(newComments.toLocaleString());
                    Swal.fire("Success", "Your comment has been added!", "success");
                    renderComments();
                });
        });
    });

    // Accessibility
    initAccessibility();
}

export async function getPosts() {
    const query = new URLSearchParams(window.location.search);
    const id = query.get("id");

    const data = await sendRequest({
        url: id ? `/api/v1/get/post/${id}` : `/api/v1/get/posts/?skip=${postsState.skip}`,
    });

    if (!data.success) return Swal.fire(data.error);
    renderPosts(Array.isArray(data.posts) ? data.posts : (data.posts ? [data.posts] : []));
}

getPosts();