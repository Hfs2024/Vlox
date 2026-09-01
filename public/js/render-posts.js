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

    // Input comments
    const inputComment = async ({ title = "Add comment", value = "", onSubmit }) => {
        const result = await Swal.fire({
            title: title,
            input: 'text',
            inputValue: value,
            inputPlaceholder: 'Type your comment here...',
            showCancelButton: true,
            preConfirm: result => {
                if (!result) return Swal.showValidationMessage("This field cannot be empty!");
                if (result.length > 200) return Swal.showValidationMessage("Comment cannot exceed 200 characters!");

                return result;
            }
        });

        if (result.isConfirmed && typeof onSubmit === "function") return onSubmit(result.value);
    }

    // Reply comments
    const replyComment = (postId, commentId) => {
        inputComment({
            title: "Add reply:",
            onSubmit: async (content) => {
                const replyResponse = await NS.fetch({
                    url: `/api/v1/reply/comment/post/${postId}`,
                    method: "POST",
                    body: { reply: content, rootId: commentId }
                });

                if (!replyResponse.success) return Swal.fire(replyResponse.error);
                Swal.fire("Success", "Reply added!", "success");
            }
        });
    }

    // Posts
    posts.forEach(async post => {
        // Elements
        const postCard = NS(NS.createEl("div", postsContainer, { className: "card" }));
        const postHeader = NS.createEl("div", postCard, { className: "space-between" });
        NS(NS.createEl("h2", postHeader, { className: "overflow" })).setText(post.title);
        const postHeaderIconsGroup = NS.createEl("div", postHeader, { className: "center" });
        if (!post.forkerId) {
            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-paste icon-post", role: "button", tabIndex: "0" })).on("click", function () {
                NS.copy({
                    text: post.content,
                    onSuccess: async () => {
                        const result = await Swal.fire({
                            title: "Copied!",
                            text: "Click OK to open PasteDB if you want to share the copied text quickly!",
                            icon: "success",
                            showCancelButton: true,
                            confirmButtonText: "OK",
                            cancelButtonText: "Cancel"
                        });

                        if (result.isConfirmed) window.open("https://pastedb.netlify.app/", "_blank");
                    },
                    onFailure: () => {
                        Swal.fire("Error", "Failed to copy. Try again later", "error");
                    }
                });
            });

            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-bookmark icon-post", role: "button", tabIndex: "0" })).on("click", lockEvent(async function () {
                const bookmarkResponse = await NS.fetch({
                    url: `/api/v1/bookmark/post/${post._id}`,
                    method: "POST"
                });

                if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
                Swal.fire("Success", "Post bookmarked!", "success");
            }));
        } else {
            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-clock-rotate-left icon-post", role: "button", tabIndex: "0" })).on("click", lockEvent(async function () {
                const postResponse = await NS.fetch({
                    url: `/api/v1/get/post/${post.rootId}`
                });

                if (!postResponse.success) return Swal.fire(postResponse.error);
                renderPosts(Array.isArray(postResponse.posts) ? postResponse.posts : [postResponse.posts]);
                Swal.fire("Success", "Successfully loaded the root post!", "success");
            }));

            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-trash icon-post", role: "button", tabIndex: "0" })).on("click", lockEvent(async function () {
                const result = await Swal.fire({
                    title: "Are you sure you want to delete the fork?",
                    showCancelButton: true
                });

                if (!result.isConfirmed) return;
                const forkDeleteResponse = await NS.fetch({
                    url: `/api/v1/delete/fork/${post._id}`,
                    method: "DELETE"
                });

                if (!forkDeleteResponse.success) return Swal.fire(forkDeleteResponse.error);
                Swal.fire("Success", "Successfully deleted!", "success");
            }));
        };
        NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" })).on("click", async function () {
            NS.copy({
                text: generatePostLink(post._id),
                onSuccess: () => { Swal.fire("Success", "Copied!", "success") },

                onFailure: () => { Swal.fire("Error", "Failed to copy. Try again later", "error") }
            });
        });

        // Content
        const isLongPost = post.content.length >= 500;
        const chattingWith = post?.forkerId?.username === window?.currentUserQuickInfo?.username ? `${post?.receiverId?.emoji} ${post?.receiverId?.username}` : `${post?.forkerId?.emoji} ${post?.forkerId?.username}`;
        const content = cleanHTML(post.content) || "No content found";
        const contentEl = NS(NS.createEl("div", postCard, { className: "overflow" })).html(
            post.spoilers
                ? "<button class='btn-danger w-full'><i class='fas fa-circle-exclamation'></i> Show Spoilers</button>"
                : isLongPost ? "<button class='show-long-post-btn w-full'><i class='fas fa-up-long'></i> Show Long Post</button>"
                    : content);

        // Show spoliers/long posts
        NS(postCard.get(".btn-danger")[0]).on("click", function () {
            contentEl.html(content);
        });

        NS(postCard.get(".show-long-post-btn")[0]).on("click", function () {
            contentEl.html(content);
        });

        // Author
        NS(NS.createEl("p", postCard, {
            style: `color: ${post.rootId ? "green" : "#ff0000"}; display:block; margin-bottom: 8px; cursor: pointer`,
            role: "button", tabIndex: "0"
        }))
            .html(`Created by: ${post.by.emoji || "🚀"} <span class='author-name'>${capitalizeFirstLetter(post.by?.username) || "Someone"}</span> ${post.rootId ? `- You're chatting with <span class='user-chatting-with'>${chattingWith}</span>` : ""}`).on("click", async function () {
                const authorProfileData = await NS.fetch({
                    url: `/api/v1/get/user-profile/${post.by._id}/?skip=0`
                });

                if (!authorProfileData.success) return Swal.fire(authorProfileData.error);
                showProfile(authorProfileData);
            });

        // Replies
        const renderReplies = async (id) => {
            const data = await NS.fetch({
                url: `/api/v1/get/post/replies/${post._id}/${id}`
            });

            if (!data.success) return Swal.fire(data.error);
            if (data.replies.length <= 0) return Swal.fire("No replies yet");
            Swal.fire({
                title: "Replies",
                html: "<div id='replies-container' class='scroll-postsContainer'></div>",
                confirmButtonText: "Close"
            });

            const repliesList = NS("#replies-container");
            data.replies.forEach(reply => {
                const replyItem = NS(NS.createEl("div", repliesList, { className: "comment-item space-between" }));
                replyItem.html(`
                        <div class='center' style='gap: 5px'>
                          <div class='comment-item-author'>
                            ${reply.by.username === reply.by.username ? "<i class='fas fa-medal' title='Author'></i>" : reply.by.emoji}
                            ${capitalizeFirstLetter(reply.by.username)}:
                            </div>
                          <div class='reply-item-content'></div>
                        </div>

                        <div class='center comment-item-icons'>
                           <i class='fas fa-reply icon-post reply-btn' role='button' tabindex='0'></i>
                           <i class='fas fa-eye icon-post view-reply-btn' role='button' tabindex='0'></i>
                        </div>
                    `).on("click", function (e) {
                    e.preventDefault();
                    if (reply.by.username !== window?.currentUserQuickInfo?.username) return;

                    inputComment({
                        title: "Update reply:",
                        value: NS(replyItem.get(".reply-item-content")[0]).getText()[0],
                        onSubmit: async (content) => {
                            const updateReplyResponse = await NS.fetch({
                                url: `/api/v1/edit/post/comment/${reply.for}`,
                                method: "PUT",
                                body: { newComment: content, commentId: reply._id }
                            });

                            if (!updateReplyResponse.success) return Swal.fire(updateReplyResponse.error);
                            Swal.fire("Success", "Reply updated!", "success");
                            NS(replyItem.get(".reply-item-content")[0]).setText(content || "No content found");
                        }
                    });
                });

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
            const data = await NS.fetch({
                url: `/api/v1/get/post/comments/${post._id}/?skip=${commentsSkip}`,
            });

            if (!data.success) return Swal.fire(data.error);
            commentsList.html(""); // Clear previous comments

            if (!data.comments || data.comments.length <= 0) {
                NS(NS.createEl("div", commentsList, { className: "state-no-comments" }))
                    .setText("No comments yet.");
                return;
            }

            data.comments.forEach(comment => {
                const commentItem = NS(NS.createEl("div", commentsList, { className: "comment-item space-between" }));
                commentItem.html(`
                        <div class='center' style='gap: 5px'>
                          <div class='comment-item-author'>
                            ${comment.by.username === post.by.username ? "<i class='fas fa-medal' title='Author'></i>" : comment.by.emoji}
                            ${capitalizeFirstLetter(comment.by.username)}:
                            </div>
                          <div class='comment-item-content'></div>
                        </div>

                        <div class='center comment-item-icons'>
                           <i class='fas fa-reply icon-post reply-btn' role='button' tabindex='0'></i>
                           <i class='fas fa-eye icon-post view-reply-btn' role='button' tabindex='0'></i>
                        </div>
                    `).on("click", function (e) {
                    e.preventDefault();
                    if (comment.by.username !== window?.currentUserQuickInfo?.username) return;

                    inputComment({
                        title: "Update comment:",
                        value: NS(commentItem.get(".comment-item-content")[0]).getText()[0],
                        onSubmit: async (content) => {
                            const updateCommentResponse = await NS.fetch({
                                url: `/api/v1/edit/post/comment/${comment.for}`,
                                method: "PUT",
                                body: { newComment: content, commentId: comment._id }
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
        NS(NS.createEl("button", commentsNavGroup, { className: "comments-prev" })).on("click", async function () {
            if (commentsSkip <= 0) return;
            commentsSkip -= 10;
            renderComments();
        }).html("<i class='fa-solid fa-chevron-left'></i>");
        NS(NS.createEl("button", commentsNavGroup, { className: "comments-next" })).on("click", async function () {
            if (postCard.get(".state-no-comments")[0]) return;
            commentsSkip += 10;
            renderComments();
        }).html("<i class='fa-solid fa-chevron-right'></i>");
        NS(postCard.get(".show-comments-btn")[0]).on("click", async function () {
            renderComments();
        });

        // Options
        const optionsDiv = NS.createEl("div", postCard, { className: "options" });

        // Like
        const likeBtn = NS(NS.createEl("button", optionsDiv, {})).on("click", lockEvent(async function () {
            const likesResponse = await NS.fetch({
                url: `/api/v1/react/like/post/${post._id}`,
                method: "POST"
            });

            if (likesResponse.error) return Swal.fire(likesResponse.error);
            const newLikes = post.likes + 1;
            likeBtn.html(`<i class="fa-solid fa-thumbs-up"></i> ${newLikes.toLocaleString()}`);
        })).html(`<i class="fa-solid fa-thumbs-up"></i> ${post.likes.toLocaleString() || 0}`);

        // Report
        const reportBtn = NS(NS.createEl("button", optionsDiv, {})).on("click", lockEvent(async function () {
            const reportResponse = await NS.fetch({
                url: `/api/v1/react/report/post/${post._id}`,
                method: "POST"
            });

            if (!reportResponse.success) return Swal.fire(reportResponse.error);
            const newReports = post.reports + 1;
            reportBtn.html(`<i class="fa-solid fa-warning"></i> ${newReports.toLocaleString()}`);
        })).html(`<i class="fa-solid fa-warning"></i> ${post.reports.toLocaleString() || 0}`);

        // Comment
        NS(NS.createEl("button", optionsDiv, {})).on("click", function () {
            inputComment({
                title: "Add a comment:",
                onSubmit: async (content) => {
                    const commentResponse = await NS.fetch({
                        url: `/api/v1/comment/post/${post._id}`,
                        method: "POST",
                        body: { comment: content }
                    });

                    if (!commentResponse.success) return Swal.fire(commentResponse.error);
                    const newComments = Number(NS(this).getText()[0]) + 1;
                    NS(this).html(`<i class="fa-solid fa-comment"></i> ${newComments.toLocaleString()}`);
                    Swal.fire("Success", "Your comment has been added!", "success");
                    renderComments();
                }
            });
        }).html(`<i class="fa-solid fa-comment"></i> ${post.comments.toLocaleString() || 0}`);

        // Fork and boost
        if (!post.boosted && !post.rootId) {
            NS(NS.createEl("button", optionsDiv, {})).html("<i class='fa-solid fa-code-fork'></i>").on("click", async function () {
                const result = await Swal.fire({
                    title: "Enter receiver username: ",
                    input: "text",
                    inputPlaceholder: "Enter receiver username...",
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("Please enter a valid receiver username!");
                        if (result.length < 3 || result.length > 10) return Swal.showValidationMessage("Username must be between 3 and 10 chars!");
                    }
                });

                if (result.value && result.isConfirmed) {
                    const forkResponse = await NS.fetch({
                        url: `/api/v1/fork/post/${post._id}`,
                        method: "POST",
                        body: { receiverUsername: result.value }
                    });

                    if (!forkResponse.success) return Swal.fire(forkResponse.error);
                    Swal.fire("Success", "Fork created!", "success");
                    getPosts();
                }
            });

            NS(NS.createEl("button", optionsDiv, {})).html("<i class='fa-solid fa-repeat'></i>").on("click", function () {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

                createPostTitle.setVal("[BOOST]");
                createPostKeywords.setVal("boost");
                createPostContent.setVal(`View ${generatePostLink(post._id)}`);
                createPostContentCount.setText(`${createPostContent.getVal()[0].length}/${window?.currentUserQuickInfo?.maxPostContentCharsLength || 2000}`);
            });
        }
    });

    // Themes
    const postsComponentClasses = themes[currentTheme]?.filter(rule => rule?.postsComponentElements?.length > 0);
    if (postsComponentClasses?.length > 0) runThemeEngine(postsComponentClasses, "postsComponentElements");
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