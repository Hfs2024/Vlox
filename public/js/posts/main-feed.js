import showProfile from "../users/profile.js";
import showComments from "./comments.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    renderSafeHtml,
    generatePostLink,
    lockEvent,
    copy,
    config,
    $,
    input
} from "../core/utils.js";

const query = new URLSearchParams(window.location.search);

export const postsState = {
    skip: 0,
    customPostId: query.get("id")
}

export async function renderPosts(posts = []) {
    // Clear container
    const postsContainer = $("#posts-container");
    postsContainer.empty();

    // No data
    if (!Array.isArray(posts) || posts.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>No posts found!</b>")
            .appendTo(postsContainer);
        return;
    }

    // Render data
    const fragment = new DocumentFragment();

    posts.forEach(post => {
        const safePost = post || {};
        const safeBy = safePost.by || {};
        const postCard = $("<div>").addClass("card").appendTo(fragment);
        const postHeader = $("<div>").addClass("space-between").appendTo(postCard);

        // Header
        $("<h2>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(safePost.title) || "No title found")
            .appendTo(postHeader);

        const postIconsGroup = $("<div>").addClass("center");
        postHeader.append(postIconsGroup);

        $("<i>")
            .addClass("fas fa-bookmark post-icon")
            .attr({ role: "button", tabindex: "0" })
            .on("click", lockEvent(async function () {
                const bookmarkResponse = await sendRequest({
                    url: `/api/v1/bookmarks/${safePost._id}`,
                    method: "POST"
                });

                if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
                Swal.fire("Success", "Post bookmarked!", "success");
            }))
            .appendTo(postIconsGroup);

        $("<i>")
            .addClass("fas fa-link post-icon")
            .attr({ role: "button", tabindex: "0" })
            .on("click", async function () {
                copy(generatePostLink(safePost._id));
            })
            .appendTo(postIconsGroup);

        // Content
        $("<div>")
            .addClass("post-content")
            .html(renderSafeHtml(safePost.content) || "No content found")
            .appendTo(postCard);

        // Author

        $("<p>")
            .css({ color: "red", cursor: "pointer" })
            .attr("role", "button")
            .attr("tabindex", "0")
            .html(`Created by: <span class="author-name">${capitalizeFirstLetter(safeBy.username) || "User"}</span>`)
            .on("click", async function () {
                showProfile(safeBy._id);
            })
            .appendTo(postCard);

        // Actions
        const reactions = $("<div>").addClass("reactions-container");
        postCard.append(reactions);
        const likes = Number(safePost.likes) || 0;

        $("<button>")
            .html(`<i class="fas fa-thumbs-up"></i> <span class="likes-count">${likes}</span>`)
            .on("click", lockEvent(async function () {
                const likesResponse = await sendRequest({
                    url: `/api/v1/posts/${safePost._id}/like`,
                    method: "POST"
                });

                if (likesResponse.error) return Swal.fire(likesResponse.error);
                $(this).find(".likes-count").text(likes + 1);
                Swal.fire("Success", "Post liked!", "success");
            }))
            .appendTo(reactions);

        $("<button>")
            .html(`<i class="fas fa-comments"></i>`)
            .on("click", lockEvent(async function () {
                await showComments(safePost._id);
            }))
            .appendTo(reactions);

        $("<button>")
            .html(`<i class="fas fa-share"></i>`)
            .on("click", lockEvent(async function () {
                const result = await input({
                    title: "Add comment: ",
                    inputAttributes: {
                        maxLength: config.COMMENTS_MAX_LENGTH
                    },
                    preConfirm: result => {
                        if (!result.length) return Swal.showValidationMessage("Please enter a comment!");
                    }
                });

                if (!result.isConfirmed) return;

                const response = await sendRequest({
                    url: `/api/v1/posts/${safePost._id}/comments`,
                    method: "POST",
                    body: {
                        content: result.value
                    }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Comment added!", "success");
            }))
            .appendTo(reactions);
    });

    postsContainer.append(fragment);
}

export async function getPosts(postId = null) {
    try {
        const data = await sendRequest({
            url: postId ?
                `/api/v1/posts/${postId}` :
                `/api/v1/posts/?skip=${postsState.skip}`,
        });

        if (!data.success) return Swal.fire(data.error);
        renderPosts(data.posts);
    } catch {
        Swal.fire("Error", "Something went wrong!", "error");
    }
}