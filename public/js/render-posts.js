let skip = 0;

function decodeHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.documentElement.textContent;
}

async function renderPosts(posts, skip = 0) {
    const postsIds = posts.map(post => post._id);

    let commentsData = await NS.fetch({
        url: "api/get/posts/comments/",
        method: "POST",
        body: { ids: postsIds }
    });

    if (commentsData.error) return Swal.fire(commentsData.error);

    const container = NS("#posts-container");
    container.html("");

    if (!posts || posts.length === 0) {
        const noPostFound = NS.createEl("h2", container, {
            className: "nothing-found",
            style: "text-align: center"
        });
        noPostFound.textContent = "No posts yet. Be the first one to post!";
        return;
    }

    posts.forEach(async (post, index) => {
        const postCard = NS.createEl("div", container, { className: "post" });
        const postHeader = NS.createEl("div", postCard, { className: "space-between" });
        NS(NS.createEl("h2", postHeader, {})).setText(decodeHTML(post.title));
        const postHeaderIconsGroup = NS.createEl("div", postHeader, { className: "center" });
        NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-bookmark post-header-group-icon" })).on("click", async function () {
            const bookmarkResponse = await NS.fetch({
                url: `/api/v1/bookmark/post/${post._id}`,
                method: "POST"
            });

            if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
            Swal.fire("Succcess", "Post bookmarked!", "success");
        });
        NS(NS.createEl("i", postHeaderIconsGroup, { className: "fas fa-link post-header-group-icon" })).on("click", async function () {
            NS.copy({
                text: `${window.location.href}?id=${post._id}`,
                onSuccess: () => {
                    Swal.fire("Success", "Copied!", "success")
                },

                onFailure: () => {
                    Swal.fire("Error", "Failed to copy. Try again later", "error");
                }
            });
        });
        NS(NS.createEl("p", postCard, {})).setText(decodeHTML(post.content));
        NS(NS.createEl("p", postCard, {
            style: "color: #ff0000; display:block; margin-bottom: 8px; cursor: pointer",
        })).html(`Created by: ${decodeHTML(post.by.emoji)} <span class='author-name'>${capitalizeFirstLtter(post.by.username)}</span>`).attr("tabindex", 0).attr("role", "button").on("click", function () {
            NS(".post").each(foundPost => {
                foundPost = NS(foundPost);
                const foundPostAuthor = NS(foundPost.get(".author-name")[0]).getText()[0].toLowerCase();
                if (foundPostAuthor === post.by.username.toLowerCase()) foundPost.css({ display: "block" });
                else foundPost.css({ display: "none" });
            });
        }).on("contextmenu", async function (e) {
            e.preventDefault();
            const authorProfileData = await NS.fetch({
                url: `/api/get/user-profile/${post.by.username}`
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
                    const commentItem = NS(NS.createEl("div", commentsList, { className: "comment-item" }));
                    commentItem.html(`
                        ${decodeHTML(comment.by.emoji)} 
                        <span class='comment-item-author'>${capitalizeFirstLtter(comment.by.username)}</span>:
                        ${comment.content}`
                    );
                    commentItem.on("contextmenu", function (e) {
                        e.preventDefault();
                        if (comment.by.username !== window.currentUserQuickInfo.username) return;

                        Swal.fire({
                            title: "Update comment: ",
                            showCancelButton: true,
                            html: `
                  <input type='text' id="update-comment-input" placeholder='Type your comment here...' />
                  <p class="count-text-wrapper">
                    Count:
                    <span class="count" id="update-comment-count">0/200</span>
                  </p>
                `,
                            didOpen: () => {
                                NS.liveCounter({
                                    element: "#update-comment-input",
                                    counterElement: "#update-comment-count",
                                    showCounter: true,
                                    max: 200,
                                    visualFeedback: [
                                        { value: 100, class: "count-orange", addTo: ["#update-comment-input"] },
                                        { value: 170, class: "count-red", addTo: ["#update-comment-input"] },
                                    ],
                                    onLimit: () => { }
                                });

                                NS("#update-comment-input").focus();
                            },

                            preConfirm: () => {
                                const comment = Swal.getPopup().querySelector("#update-comment-input").value;
                                if (!comment) Swal.showValidationMessage("Comment cannot be empty!");
                            }
                        }).then(async result => {
                            if (result.isConfirmed) {
                                const updateCommentResponse = await NS.fetch({
                                    url: `/api/v1/edit/post/comment/${comment._id}/`,
                                    method: "PUT",
                                    body: { newComment: NS("#update-comment-input").getVal()[0] }
                                });

                                if (!updateCommentResponse.success) return Swal.fire(updateCommentResponse.error);
                                Swal.fire("Success", "Comment updated!", "success");
                                commentItem.html(`<span style='color: green'>${decodeHTML(comment.by.emoji)} ${capitalizeFirstLtter(comment.by.username)}</span>: ${updateCommentResponse.updatedDoc.content}`);
                            }
                        });
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
        likeBtn.html(`<i class="fa-solid fa-thumbs-up"></i> ${post.likes || 0}`);
        const reportBtn = NS(NS.createEl("button", optionsDiv, {}));
        reportBtn.html(`<i class="fa-solid fa-warning"></i> ${post.reports || 0}`);
        const commentBtn = NS(NS.createEl("button", optionsDiv, {}));
        commentBtn.html(`<i class="fa-solid fa-comment"></i> ${post.comments || 0}`);

        // Actions
        likeBtn.on("click", async () => {
            const response = await NS.fetch({
                url: `api/v1/like/post/${post._id}`,
                method: "POST"
            });

            if (response.error) return Swal.fire(response.error);
            likeBtn.html(`<i class="fa-solid fa-thumbs-up"></i> ${response.likes || 0}`);
        });

        reportBtn.on("click", async () => {
            const response = await NS.fetch({
                url: `api/v1/report/post/${post._id}`,
                method: "POST"
            });

            if (!response.success) return Swal.fire(response.error);
            reportBtn.html(`<i class="fa-solid fa-warning"></i> ${response.reports || 0}`);
        });

        commentBtn.on("click", async () => {
            const comment = await Swal.fire({
                title: "Add a comment",
                html: `
                  <input type='text' id="create-comment-input" placeholder='Type your comment here...' />
                  <p class="count-text-wrapper">
                    Count:
                    <span class="count" id="create-comment-count">0/200</span>
                  </p>
                `,
                didOpen: () => {
                    NS.liveCounter({
                        element: "#create-comment-input",
                        counterElement: "#create-comment-count",
                        showCounter: true,
                        max: 200,
                        visualFeedback: [
                            { value: 100, class: "count-orange", addTo: ["#create-comment-input"] },
                            { value: 170, class: "count-red", addTo: ["#create-comment-input"] },
                        ],
                        onLimit: () => { }
                    });

                    NS("#create-comment-input").focus();
                },
                showCancelButton: true,
                confirmButtonText: "Submit",
                preConfirm: () => {
                    const comment = Swal.getPopup().querySelector("#create-comment-input").value;
                    if (!comment) Swal.showValidationMessage("Comment cannot be empty!");
                }
            }).then(async (result) => {
                if (!result.isConfirmed) return;
                const response = await NS.fetch({
                    url: `api/v1/comment/post/${post._id}`,
                    method: "POST",
                    body: { comment: NS("#create-comment-input").getVal()[0] }
                });

                if (!response.success) return Swal.fire(response.error);
                commentBtn.html(`<i class="fa-solid fa-comment"></i> ${response.comments || 0}`);
                Swal.fire("Success", "Your comment has been added!", "success");
                commentsData = await NS.fetch({
                    url: "api/get/posts/comments/",
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
                url: "api/get/posts/comments/",
                method: "POST",
                body: { ids: post._id, customId: true, skip: commentsSkip }
            });

            renderComments(newComments.comments);
        });

        commentsNext.on("click", async function () {
            if (NS(postCard).get(".no-comments")[0]) return;
            commentsSkip += 10;

            const newComments = await NS.fetch({
                url: "api/get/posts/comments/",
                method: "POST",
                body: { ids: post._id, customId: true, skip: commentsSkip }
            });

            renderComments(newComments.comments);
        });

        renderComments();
    });
}

async function getPosts() {
    const query = new URLSearchParams(window.location.search);
    const id = query.get("id");

    const data = await NS.fetch({
        url: id ? `/api/get/post/${id}` : `/api/get/posts/?skip=${skip}`
    });

    if (data.error) return Swal.fire(data.error);
    renderPosts(Array.isArray(data.posts) ? data.posts : [data.posts], skip);
}

NS("#reload-btn").on("click", function () {
    getPosts();
});

getPosts();