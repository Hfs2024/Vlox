let skip = 0;

async function renderPosts(posts, skip = 0) {
    const postsIds = posts.map(post => post._id);
    let commentsData = await NS.fetch({
        url: "/api/v1/get/posts/comments/",
        method: "POST",
        body: { ids: postsIds }
    });

    if (commentsData.error) return Swal.fire(commentsData.error);

    const container = NS("#posts-container");
    container.html("");

    if (!posts || posts.length === 0) {
        const noPostFound = NS.createEl("h2", container, {
            className: "nothing-found"
        });
        noPostFound.textContent = "No posts yet. Be the first one to post!";
        return;
    }

    const inputComment = (title = "", commentInputId = "", commentCountId = "", onSubmit) => {
        Swal.fire({
            title: title || "Add comment",
            showCancelButton: true,
            html: `
                  <input type='text' id="${commentInputId}" placeholder='Type your comment here...' />
                  <p class="count-text-wrapper">
                    Count:
                    <span class="count" id="${commentCountId}">0/200</span>
                  </p>
                `,
            didOpen: () => {
                NS.liveCounter({
                    selector: `#${commentInputId}`,
                    counterElement: `#${commentCountId}`,
                    showCounter: true,
                    max: 200,
                    visualFeedback: [
                        { value: 100, class: "count-orange", addTo: [`#${commentInputId}`] },
                        { value: 170, class: "count-red", addTo: [`#${commentInputId}`] },
                    ]
                });

                NS(`#${commentInputId}`).focus();
            },

            preConfirm: () => {
                const comment = Swal.getPopup().querySelector(`#${commentInputId}`).value;
                if (!comment) Swal.showValidationMessage("Comment cannot be empty!");
            }
        }).then(async result => {
            if (!result.isConfirmed) return;
            const content = NS(`#${commentInputId}`).getVal()[0];
            if (typeof onSubmit === "function") return onSubmit(content);
        });
    }

    posts.forEach(async (post, index) => {
        const postCard = NS.createEl("div", container, { className: "post" });
        const postHeader = NS.createEl("div", postCard, { className: "space-between" });
        NS(NS.createEl("h2", postHeader, {})).setText(post.title);
        const postHeaderIconsGroup = NS.createEl("div", postHeader, { className: "center" });
        if (!post.forkerId) {
            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-paste post-icon" })).on("click", function () {
                NS.copy({
                    text: post.content,
                    onSuccess: () => {
                        Swal.fire({
                            title: "Copied!",
                            text: "Click OK to open PasteDB if you want to share the copied text quickly!",
                            icon: "success",
                            showCancelButton: true,
                            confirmButtonText: "OK",
                            cancelButtonText: "Cancel"
                        }).then(result => {
                            if (result.isConfirmed) window.open("https://pastedb.netlify.app/", "_blank");
                        });
                    },
                    onFailure: () => {
                        Swal.fire("Error", "Failed to copy. Try again later", "error");
                    }
                });
            });

            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-bookmark post-icon" })).on("click", async function () {
                const bookmarkResponse = await NS.fetch({
                    url: `/api/v1/bookmark/post/${post._id}`,
                    method: "POST"
                });

                if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
                Swal.fire("Success", "Post bookmarked!", "success");
            });
        } else {
            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-clock-rotate-left post-icon" })).on("click", async function () {
                const postResponse = await NS.fetch({
                    url: `/api/v1/get/post/${post.rootId}`
                });

                if (!postResponse.success) return Swal.fire(postResponse.error);
                renderPosts(Array.isArray(postResponse.posts) ? postResponse.posts : [postResponse.posts], skip);
                Swal.fire("Success", "Successfully loaded the root post!", "success");
            });

            NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-trash post-icon" })).on("click", async function () {
                Swal.fire({
                    title: "Are you sure you want to delete the fork?",
                    showCancelButton: true
                }).then(async result => {
                    if (!result.isConfirmed) return;
                    const forkDeleteResponse = await NS.fetch({
                        url: `/api/v1/delete/fork/${post._id}`,
                        method: "DELETE"
                    });

                    if (!forkDeleteResponse.success) return Swal.fire(forkDeleteResponse.error);
                    Swal.fire("Success", "Successfully deleted!", "success");
                    getPosts();
                });
            });
        };

        NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-link post-icon" })).on("click", async function () {
            NS.copy({
                text: generatePostLink(post._id),
                onSuccess: () => { Swal.fire("Success", "Copied!", "success") },

                onFailure: () => { Swal.fire("Error", "Failed to copy. Try again later", "error") }
            });
        });

        const chattingWith = post?.forkerId?.username === window.currentUserQuickInfo.username ? `${post?.receiverId?.emoji} ${post?.receiverId?.username}` : `${post?.forkerId?.emoji} ${post?.forkerId?.username}`;
        const content = cleanHTML(post.content) || "Not content found";
        const contentEl = NS(NS.createEl("div", postCard, {
            style: 'overflow: auto'
        })).html(post.spoilers ? "<button class='show-spoliers-btn'><i class='fas fa-circle-exclamation'></i> Show Spoilers</button>" : content);
        NS(".show-spoliers-btn").on("click", function () {
            contentEl.html(content);
        });
        NS(NS.createEl("p", postCard, {
            style: `color: ${post.rootId ? "green" : "#ff0000"}; display:block; margin-bottom: 8px; cursor: pointer`,
        }))
            .html(`Created by: ${post.by.emoji || "🚀"} <span class='author-name'>${capitalizeFirstLtter(post.by?.username) || "Someone"}</span> ${post.rootId ? `- You're chatting with <span class='user-chatting-with'>${chattingWith}</span>` : ""}`)
            .attr("tabindex", 0).attr("role", "button").on("click", function () {
                NS(".post").each(foundPost => {
                    foundPost = NS(foundPost);
                    const foundAuthor = NS(foundPost.get(".author-name")[0]).getText()[0].toLowerCase();
                    const foundChattingWith = foundPost.get(".user-chatting-with")[0];
                    if (post.rootId) {
                        if (foundChattingWith) foundPost.css({ display: "block" });
                        else foundPost.css({ display: "none" });
                    } else {
                        if (foundAuthor === post.by.username.toLowerCase()) foundPost.css({ display: "block" });
                        else foundPost.css({ display: "none" });
                    }
                });
            }).on("contextmenu", async function (e) {
                e.preventDefault();
                const isUsernameMatch = window.currentUserQuickInfo?.username === post.by.username;;
                const authorProfileData = await NS.fetch({
                    url: isUsernameMatch ? "/api/v1/get/user-profile" : `/api/v1/get/user-profile/${post.by.username}`
                });

                if (!authorProfileData.success) return Swal.fire(authorProfileData.error);
                showProfile(authorProfileData);
            });

        const commentsList = NS(NS.createEl("div", postCard, { className: "comments-list" }));
        let commentsSkip = 0;

        const renderComments = (newComments) => {
            commentsList.html(""); // Clear previous comments
            const comments = newComments || commentsData.comments[post._id]; // This won't be slow because it gets 50 posts, and the max amount of comments the server gets in a single operation is 10, so, 50*10=500, which is still in the safe zone.

            if (comments && comments.length > 0) {
                comments.forEach(comment => {
                    const commentItem = NS(NS.createEl("div", commentsList, { className: "comment-item space-between" }));
                    commentItem.html(`
                        <div class='center' style='gap: 5px'>
                          <div class='comment-item-author'>
                            ${comment.by.username === post.by.username ? "<i class='fas fa-medal' title='Author'></i>" : comment.by.emoji}
                            ${capitalizeFirstLtter(comment.by.username)}:
                            </div>
                          <div class='comment-item-content'></div>
                        </div>

                        <div class='center comment-item-icons'>
                           <i class='fas fa-reply post-icon reply-comment-btn' role='button' tabindex='0'></i>
                           <i class='fas fa-eye post-icon view-reply-btn' role='button' tabindex='0'></i>
                        </div>
                    `).on("click", function () {
                        NS.copy({
                            text: NS(commentItem.get(".comment-item-content")[0]).getText()[0] || "No content found",
                            onSuccess: () => {
                                Swal.fire("Success", "Copied comment content!", "success")
                            },

                            onFailure: () => {
                                Swal.fire("Error", "Failed to copy. Try again later", "error");
                            }
                        });
                    }).on("contextmenu", function (e) {
                        e.preventDefault();
                        if (comment.by.username !== window.currentUserQuickInfo.username) return;

                        inputComment("Update comment:", "update-comment-input", "update-comment-count", async (content) => {
                            const updateCommentResponse = await NS.fetch({
                                url: `/api/v1/edit/post/comment/${comment.for}/`,
                                method: "PUT",
                                body: { newComment: content }
                            });

                            if (!updateCommentResponse.success) return Swal.fire(updateCommentResponse.error);
                            Swal.fire("Success", "Comment updated!", "success");
                            NS(commentItem.get(".comment-item-content")[0]).setText(content || "No content found");
                        });
                    });

                    NS(commentItem.get(".comment-item-content")[0]).setText(comment.content || "No content found");
                    NS(".reply-comment-btn").on("click", function (e) {
                        e.stopPropagation();
                        Swal.fire("Reply comments is not implemented yet.")
                    });

                    NS(".view-reply-btn").on("click", async function (e) {
                        e.stopPropagation();
                        Swal.fire("View replies not implemented yet.");
                    });
                });
            } else {
                const noCommentsItem = NS.createEl("div", commentsList, { className: "no-comments" });
                noCommentsItem.textContent = "No comments yet.";
            }
        }

        const commentsNavGroup = NS.createEl("div", postCard, { className: "center" });
        const commentsPrev = NS(NS.createEl("button", commentsNavGroup, { className: "comments-prev" }));
        commentsPrev.html("<i class='fa-solid fa-chevron-left'></i>");
        const commentsNext = NS(NS.createEl("button", commentsNavGroup, { className: "comments-next" }));
        commentsNext.html("<i class='fa-solid fa-chevron-right'></i>");
        const optionsDiv = NS.createEl("div", postCard, { className: "options" });
        const likeBtn = NS(NS.createEl("button", optionsDiv, {}));
        likeBtn.html(`<i class="fa-solid fa-thumbs-up"></i> ${post.likes.toLocaleString() || 0}`);
        const reportBtn = NS(NS.createEl("button", optionsDiv, {}));
        reportBtn.html(`<i class="fa-solid fa-warning"></i> ${post.reports.toLocaleString() || 0}`);
        const commentBtn = NS(NS.createEl("button", optionsDiv, {}));
        commentBtn.html(`<i class="fa-solid fa-comment"></i> ${post.comments.toLocaleString() || 0}`);
        if (!post.boosted && !post.rootId) {
            NS(NS.createEl("button", optionsDiv, {})).html("<i class='fa-solid fa-code-fork'></i>").on("click", function () {
                Swal.fire({
                    title: "Enter receiver username: ",
                    input: "text",
                    inputPlaceholder: "Enter receiver username...",
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("Please enter a valid receiver username!");
                    }
                }).then(async result => {
                    if (result.value && result.isConfirmed) {
                        const forkResponse = await NS.fetch({
                            url: `/api/v1/fork/post/${post._id}`,
                            method: "POST",
                            body: { receiverId: result.value }
                        });

                        if (!forkResponse.success) return Swal.fire(forkResponse.error);
                        Swal.fire("Success", "Fork created!", "success");
                        getPosts();
                    }
                });
            });

            NS(NS.createEl("button", optionsDiv, {})).html("<i class='fa-solid fa-repeat'></i>").on("click", function () {
                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

                createPostTitle.setVal("[BOOST]");
                createPostKeywords.setVal("boost");
                createPostContent.setVal(`View ${generatePostLink(post._id)}`);
            });
        }

        // Actions
        likeBtn.on("click", async function () {
            const response = await NS.fetch({
                url: `api/v1/like/post/${post._id}`,
                method: "POST"
            });

            if (response.error) return Swal.fire(response.error);
            const newLikes = post.likes + 1;
            likeBtn.html(`<i class="fa-solid fa-thumbs-up"></i> ${newLikes.toLocaleString()}`);
        });

        reportBtn.on("click", async function () {
            const response = await NS.fetch({
                url: `api/v1/report/post/${post._id}`,
                method: "POST"
            });

            if (!response.success) return Swal.fire(response.error);
            const newReports = post.reports + 1;
            reportBtn.html(`<i class="fa-solid fa-warning"></i> ${newReports.toLocaleString()}`);
        });

        commentBtn.on("click", function () {
            inputComment("Add a comment:", "create-comment-input", "create-comment-count", async () => {
                const commentResponse = await NS.fetch({
                    url: `/api/v1/comment/post/${post._id}`,
                    method: "POST",
                    body: { comment: NS("#create-comment-input").getVal()[0] }
                });

                if (!commentResponse.success) return Swal.fire(commentResponse.error);
                const newComments = Number(commentBtn.getText()[0]) + 1;
                commentBtn.html(`<i class="fa-solid fa-comment"></i> ${newComments.toLocaleString()}`);
                Swal.fire("Success", "Your comment has been added!", "success");
                commentsData = await NS.fetch({
                    url: "/api/v1/get/posts/comments/",
                    method: "POST",
                    body: { ids: postsIds }
                });

                renderComments();
            });
        });

        commentsPrev.on("click", async function () {
            if (commentsSkip <= 0) return;
            commentsSkip -= 10;

            const newComments = await NS.fetch({
                url: "/api/v1/get/posts/comments/",
                method: "POST",
                body: { ids: post._id, customId: true, skip: commentsSkip }
            });

            renderComments(newComments.comments);
        });

        commentsNext.on("click", async function () {
            if (NS(postCard).get(".no-comments")[0]) return;
            commentsSkip += 10;

            const newComments = await NS.fetch({
                url: "/api/v1/get/posts/comments/",
                method: "POST",
                body: { ids: post._id, customId: true, skip: commentsSkip }
            });

            renderComments(newComments.comments);
        });

        renderComments();
    });

    runAccessibility();
}

async function getPosts() {
    const query = new URLSearchParams(window.location.search);
    const id = query.get("id");

    const data = await NS.fetch({
        url: id ? `/api/v1/get/post/${id}` : `/api/v1/get/posts/?skip=${skip}`
    });

    if (!data.success) return Swal.fire(data.error);
    renderPosts(Array.isArray(data.posts) ? data.posts : [data.posts], skip);
}

NS("#reload-btn").on("click", function () {
    getPosts();
});

getPosts();
