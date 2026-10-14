import showProfile from "./profile.js";
import showComments from "./comments.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    cleanHTML,
    generatePostLink,
    initAccessibility,
    lockEvent,
    copy,
    config, 
    $
} from "./utils.js";

const query = new URLSearchParams(window.location.search);
export const postsState = {
    skip: 0,
    customPostId: query.get("id")
};

export async function renderPosts(posts = []) {
    const postsContainer = $("#posts-container");
    postsContainer.html("");

    if (!Array.isArray(posts) || posts.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>No posts found!</b>")
            .appendTo(postsContainer);
        return;
    }

    posts.forEach(async post => {
        post = post || {};
        const safeBy = post.by || {};

        const postCard = $("<div>").addClass("card");
        const postHeader = $("<div>").addClass("space-between");
        postsContainer.append(postCard);
        postCard.append(postHeader);

        $("<h2>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(post.title) || "No title found")
            .appendTo(postHeader);

        const postIconsGroup = $("<div>").addClass("center");
        postHeader.append(postIconsGroup);

        $("<i>")
            .addClass("fas fa-bookmark icon-post")
            .attr("role", "button")
            .attr("tabindex", "0")
            .on("click", lockEvent(async function () {
                const bookmarkResponse = await sendRequest({
                    url: `/api/v1/bookmarks/${post._id}`,
                    method: "POST"
                });

                if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
                Swal.fire("Success", "Post bookmarked!", "success");
            }))
            .appendTo(postIconsGroup);

        $("<i>")
            .addClass("fas fa-link icon-post")
            .attr("role", "button")
            .attr("tabindex", "0")
            .on("click", async function () {
                copy(generatePostLink(post._id));
            })
            .appendTo(postIconsGroup);

        $("<div>")
            .html(cleanHTML(post.content) || "No content found")
            .appendTo(postCard);

        $("<p>")
            .css("color", "red")
            .css("cursor", "pointer")
            .attr("role", "button")
            .attr("tabindex", "0")
            .html(`Created by: <span class="author-name">${capitalizeFirstLetter(safeBy.username) || "User"}</span>`)
            .on("click", async function () {
                showProfile(safeBy._id);
            })
            .appendTo(postCard);

        const reactionsContainer = $("<div>").addClass("reactions");
        postCard.append(reactionsContainer);
        const likes = Number(post.likes) || 0;

        $("<button>")
            .html(`<i class="fas fa-thumbs-up"></i> <span class="likes-count">${likes}</span>`)
            .on("click", lockEvent(async function () {
                const likesResponse = await sendRequest({
                    url: `/api/v1/posts/${post._id}/like`,
                    method: "POST"
                });

                if (likesResponse.error) return Swal.fire(likesResponse.error);
                $(this).find(".likes-count").text(likes + 1);
                Swal.fire("Success", "Post liked!", "success");
            }))
            .appendTo(reactionsContainer);

        $("<button>")
            .html(`<i class="fas fa-comments"></i>`)
            .on("click", lockEvent(async function () {
                await showComments(post._id);
            }))
            .appendTo(reactionsContainer);

        $("<button>")
            .html(`<i class="fas fa-share"></i>`)
            .on("click", lockEvent(async function () {
                const result = await Swal.fire({
                    title: "Add comment: ",
                    input: "text",
                    inputPlaceholder: "Enter comment...",
                    inputAttributes: {
                        maxLength: config.COMMENTS_MAX_LENGTH
                    },
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result.length) return Swal.showValidationMessage("Please enter a comment!");
                    }
                });

                if (!result.isConfirmed) return;

                const response = await sendRequest({
                    url: `/api/v1/posts/${post._id}/comments`,
                    method: "POST",
                    body: {
                        content: result.value
                    }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Comment added!", "success");
            }))
            .appendTo(reactionsContainer);
    });

    initAccessibility();
}

export async function getPosts(postId = null) {
    const data = await sendRequest({
        url: postId ?
            `/api/v1/posts/${postId}` :
            `/api/v1/posts/?skip=${postsState.skip}`,
    });

    if (!data.success) return Swal.fire(data.error);
    renderPosts(data.posts);
}

getPosts(postsState.customPostId);