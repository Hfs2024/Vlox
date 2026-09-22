let skip = 0;

async function renderPosts(posts = []) {
    const postsContainer = NS("#posts-container");
    postsContainer.html("");

    // Nothing found
    if (!posts || posts.length === 0) {
        NS(NS.createEl("div", postsContainer, {
            className: "state-nothing-found"
        })).html("<b>No posts yet. Be the first one to post!</b>");
        return;
    }

    // Posts
    posts.forEach(async post => {
        // Elements
        const postCard = NS(NS.createEl("div", postsContainer, { className: "card" }));
        const postHeader = NS.createEl("div", postCard, { className: "space-between" });
        NS(NS.createEl("h2", postHeader, { className: "overflow" })).setText(post.title);
        const postIconsGroup = NS.createEl("div", postHeader, { className: "center" });

        // Icons
        // Bookmark
        NS(NS.createEl("i", postIconsGroup, { className: "fas fa-bookmark icon-post", role: "button", tabIndex: "0" })).on("click", (async function () {
            const bookmarkResponse = await NS.fetch({
                url: `/api/v1/bookmark/post/${post._id}`,
                method: "POST"
            });

            if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
            Swal.fire("Success", "Post bookmarked!", "success");
        }));

        // Copy link
        NS(NS.createEl("i", postIconsGroup, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" })).on("click", async function () {
            NS.copy({
                text: generatePostLink(post._id),
                onSuccess: () => { Swal.fire("Success", "Copied!", "success") },

                onFailure: () => { Swal.fire("Error", "Failed to copy. Try again later", "error") }
            });
        });

        // Content
        const content = cleanHTML(post.content) || "No content found";
        const contentEl = NS(NS.createEl("div", postCard, { className: "overflow" }))
            .html(post.spoilers ? "<button id='show-spoilers' class='btn-danger w-full'><i class='fas fa-circle-exclamation'></i> Show Spoilers</button>" : content);

        // Show spoliers/long posts
        NS(postCard.get("#show-spoilers")[0]).on("click", function () {
            contentEl.html(content);
        });

        // Author
        NS(NS.createEl("p", postCard, {
            style: `color: red; display:block; margin-bottom: 8px; cursor: pointer`,
            role: "button", tabIndex: "0"
        }))
            .html(`Created by: ${post.by.emoji || "🚀"} <span class='author-name'>${capitalizeFirstLetter(post.by.username)}</span>`).on("click", async function () {
                const authorProfileData = await NS.fetch({
                    url: `/api/v1/get/user-profile/${post.by._id}/?skip=0`
                });

                if (!authorProfileData.success) return Swal.fire(authorProfileData.error);
                showProfile(authorProfileData);
            });

        // Replies
        const renderReplies = async (id) => {
            // Get replies
            const data = await NS.fetch({
                url: `/api/v1/get/post/${post._id}/replies/${id}`
            });

            if (!data.success) return Swal.fire(data.error);
            if (data.replies.length <= 0) return Swal.fire("No replies yet!");

            // Show replies
            Swal.fire({
                title: "Replies",
                html: "<div id='replies-container' class='scroll-postsContainer'></div>",
                confirmButtonText: "Close"
            });

            data.replies.forEach(reply => {
                const replyItem = NS(NS.createEl("div", NS("#replies-container"), { className: "comment-item space-between" }));
                replyItem.html(`
<div class="center" style="gap: 5px">
  <div class="comment-item-author">
    <i class="fas fa-medal" title="Author"></i>
    ${capitalizeFirstLetter(reply.by.username)}:
  </div>
  <div class="reply-item-content"></div>
</div>

<div class="center comment-item-icons">
  <i class="fas fa-reply icon-post reply-btn" role="button" tabindex="0" aria-label="Reply"></i>
  <i class="fas fa-eye icon-post view-reply-btn" role="button" tabindex="0" aria-label="View reply"></i>
</div>
                    `).on("click", function (e) {
                    e.preventDefault();
                    if (reply.by.username !== window?.currentUserQuickInfo?.username) return;

                    inputComment({
                        title: "Update reply:",
                        value: NS(replyItem.get(".reply-item-content")[0]).getText()[0],
                        onSubmit: async (content) => {
                            const updateReplyResponse = await NS.fetch({
                                url: `/api/v1/edit/post/comment/${reply._id}`,
                                method: "PUT",
                                body: { newComment: content }
                            });

                            if (!updateReplyResponse.success) return Swal.fire(updateReplyResponse.error);
                            Swal.fire("Success", "Reply updated!", "success");
                            NS(replyItem.get(".reply-item-content")[0]).setText(content || "No content found");
                        }
                    });
                })

                NS(replyItem.get(".reply-item-content")[0]).setText(reply.content);
                NS(replyItem.get(".reply-btn")[0]).on("click", function (e) {
                    e.stopPropagation();
                    replyComment(post._id, reply._id);
                });
                NS(replyItem.get(".view-reply-btn")[0]).on("click", async function (e) {
                    e.stopPropagation();
                    renderReplies(reply._id);
                });
            });
        }

        // Comments
        const commentsList = NS(NS.createEl("div", postCard, { className: "comments-list" }))
            .html("<button class='show-comments-btn w-full'><i class='fas fa-comment'></i> Show Comments</button>");
        let commentsSkip = 0;

        const renderComments = async () => {
            // Get comments
            const data = await NS.fetch({
                url: `/api/v1/get/post/comments/${post._id}/?skip=${commentsSkip}`,
            });

            if (!data.success) return Swal.fire(data.error);
            if (data.comments.length <= 0) return Swal.fire("No comments yet!");

            // Show comments
            commentsList.html("");

            data.comments.forEach(comment => {
                const commentItem = NS(NS.createEl("div", commentsList, { className: "comment-item space-between" }));
                commentItem.html(`
<div class="center" style="gap: 5px">
  <div class="comment-item-author">
    ${comment.by.username === post.by.username ? '<i class="fas fa-medal" title="Author"></i>' : comment.by.emoji}
    ${capitalizeFirstLetter(comment.by.username)}:
  </div>
  <div class="comment-item-content"></div>
</div>

<div class="center comment-item-icons">
  <i class="fas fa-reply icon-post reply-btn" role="button" tabindex="0" aria-label="Reply"></i>
  <i class="fas fa-eye icon-post view-reply-btn" role="button" tabindex="0" aria-label="View reply"></i>
</div>
                    `).on("click", function () {
                    if (comment.by.username !== window?.currentUserQuickInfo?.username) return;

                    inputComment({
                        title: "Update comment:",
                        value: NS(commentItem.get(".comment-item-content")[0]).getText()[0],
                        onSubmit: async (content) => {
                            const updateCommentResponse = await NS.fetch({
                                url: `/api/v1/edit/post/comment/${comment._id}`,
                                method: "PUT",
                                body: { newComment: content }
                            });

                            if (!updateCommentResponse.success) return Swal.fire(updateCommentResponse.error);
                            Swal.fire("Success", "Comment updated!", "success");
                            NS(commentItem.get(".comment-item-content")[0]).setText(content || "No content found");
                        }
                    });
                });

                NS(commentItem.get(".comment-item-content")[0]).setText(comment.content || "No content found");
                NS(commentItem.get(".reply-btn")[0]).on("click", function (e) {
                    e.stopPropagation();
                    replyComment(post._id, comment._id);
                });
                NS(commentItem.get(".view-reply-btn")[0]).on("click", async function (e) {
                    e.stopPropagation();
                    renderReplies(comment._id);
                });
            });
        }

        // Comments navigation
        const commentsNavGroup = NS.createEl("div", postCard, { className: "center" });
        
        // Prev
        NS(NS.createEl("button", commentsNavGroup, { className: "comments-prev" })).on("click", async function () {
            if (commentsSkip <= 0) return;
            commentsSkip -= 10;
            renderComments();
        }).html("<i class='fa-solid fa-chevron-left'></i>");

        // Next
        NS(NS.createEl("button", commentsNavGroup, { className: "comments-next" })).on("click", async function () {
            if (postCard.get(".state-no-comments")[0]) return;
            commentsSkip += 10;
            renderComments();
        }).html("<i class='fa-solid fa-chevron-right'></i>");

        // Show comments
        NS(postCard.get(".show-comments-btn")[0]).on("click", async function () {
            renderComments();
        });

        // Options
        const optionsDiv = NS.createEl("div", postCard, { className: "options" });

        // Like
        const likesBtn = NS(NS.createEl("button", optionsDiv, {})).on("click", lockEvent(async function () {
            const likesResponse = await NS.fetch({
                url: `/api/v1/react/like/post/${post._id}`,
                method: "POST"
            });

            if (likesResponse.error) return Swal.fire(likesResponse.error);
            const newLikes = post.likes + 1;
            NS(likesBtn.get(".likes-count")[0]).setText(newLikes.toLocaleString());
        })).html(`<i class="fa-solid fa-thumbs-up"></i> <span class="likes-count">${post.likes.toLocaleString()}</span>`);

        // Report
        const reportBtn = NS(NS.createEl("button", optionsDiv, {})).on("click", lockEvent(async function () {
            const reportResponse = await NS.fetch({
                url: `/api/v1/react/report/post/${post._id}`,
                method: "POST"
            });

            if (!reportResponse.success) return Swal.fire(reportResponse.error);
            const newReports = post.reports + 1;
            NS(reportBtn.get(".reports-count")[0]).setText(newReports.toLocaleString());
        })).html(`<i class="fa-solid fa-warning"></i> <span class="reports-count">${post.reports.toLocaleString()}</span>`);

        // Comment
        const commentBtn = NS(NS.createEl("button", optionsDiv, {})).on("click", function () {
            inputComment({
                title: "Add a comment:",
                onSubmit: async (content) => {
                    const commentResponse = await NS.fetch({
                        url: `/api/v1/comment/post/${post._id}`,
                        method: "POST",
                        body: { comment: content }
                    });

                    if (!commentResponse.success) return Swal.fire(commentResponse.error);
                    const comments = NS(commentBtn.get(".comments-count")[0]);
                    const newComments = parseInt(comments.getText()[0]) + 1;
                    comments.setText(newComments.toLocaleString());
                    Swal.fire("Success", "Your comment has been added!", "success");
                    renderComments();
                }
            });
        }).html(`<i class="fa-solid fa-comment"></i> <span class="comments-count">${post.comments.toLocaleString()}</span>`);
    });

    // Theme
    applyTheme(currentTheme, "postsElements");

    // Accessibility
    initAccessibility();
}

async function getPosts() {
    const query = new URLSearchParams(window.location.search);
    const id = query.get("id");

    const data = await NS.fetch({
        url: id ? `/api/v1/get/post/${id}` : `/api/v1/get/posts/?skip=${skip}`,
    });

    if (!data.success) return Swal.fire(data.error);
    renderPosts(Array.isArray(data.posts) ? data.posts : [data.posts]);
}

getPosts();