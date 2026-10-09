import NS from "../nanoscript.min.js";
import showProfile from "./profile.js";
import config from "/config/shared.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    cleanHTML,
    generatePostLink,
    initAccessibility,
    lockEvent,
    copy
} from "./utils.js";

const query = new URLSearchParams(window.location.search);
export const postsState = {
    skip: 0,
    customPostId: query.get("id"),
    isCustomPost: query.get("id") ? true : false,
    chronological: query.get("chronological")
}

export async function renderPosts(posts = []) {
    const postsContainer = NS("#posts-container").html("");

    // Nothing found
    if (!Array.isArray(posts) || posts.length <= 0) {
        NS.createEl("div", postsContainer, { className: "state-nothing-found" })
            .html("<b>No posts yet.</b>");
        return;
    }

    // Posts
    posts.forEach(async post => {
        post = post || {};
        const safeBy = post.by || {};

        // Elements
        const postCard = NS.createEl("div", postsContainer, { className: "card" });
        const postHeader = NS.createEl("div", postCard, { className: "space-between" });
        NS.createEl("h2", postHeader, { className: "overflow" }).text(capitalizeFirstLetter(post.title) || "No title found");
        const postIconsGroup = NS.createEl("div", postHeader, { className: "center" });

        // Icons
        // Bookmark
        NS.createEl("i", postIconsGroup, { className: "fas fa-bookmark icon-post", role: "button", tabIndex: "0" })
            .on("click", lockEvent(async function () {
                const bookmarkResponse = await sendRequest({
                    url: `/api/v1/bookmarks/${post._id}`,
                    method: "POST"
                });

                if (!bookmarkResponse.success) return Swal.fire(bookmarkResponse.error);
                Swal.fire("Success", "Post bookmarked!", "success");
            }));

        // Copy link
        NS.createEl("i", postIconsGroup, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" })
            .on("click", async function () {
                copy(generatePostLink(post._id));
            });

        // Content
        NS.createEl("div", postCard, {}).html(cleanHTML(post.content) || "No content found");

        // Author
        NS.createEl("p", postCard, {
            style: "color: red; cursor: pointer",
            role: "button", tabIndex: "0"
        })
            .html(`Created by: <span class="author-name">${capitalizeFirstLetter(safeBy.username || "User")}</span>`)
            .on("click", async function () {
                showProfile(safeBy._id);
            });

        /* Reactions */
        const reactionsContainer = NS.createEl("div", postCard, { className: "reactions" });

        // Likes
        const likes = Number(post.likes ?? 0);

        NS.createEl("button", reactionsContainer, {})
            .html(`<i class="fas fa-thumbs-up"></i> <span class="likes-count">${likes.toLocaleString()}</span>`)
            .on("click", lockEvent(async function () {
                const likesResponse = await sendRequest({
                    url: `/api/v1/posts/${post._id}/react/like`,
                    method: "POST"
                });

                if (likesResponse.error) return Swal.fire(likesResponse.error);

                // Update UI
                NS(this).get(".likes-count").text(likes + 1);
                Swal.fire("Success", "Post liked!", "success");
            }));

        // Comment
        NS.createEl("button", reactionsContainer, {})
            .html(`<i class="fas fa-comments"></i> <span class="likes-count">${likes.toLocaleString()}</span>`)
            .on("click", lockEvent(async function () {
                Swal.fire("Info", "Still working on ths feature...", "info");
            }));

        // Reports
        NS.createEl("button", reactionsContainer, {})
            .html("<i class='fas fa-warning'></i>")
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/posts/${post._id}/react/report`,
                    method: "POST"
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Post reported", "success");
            }));
    });

    // Accessibility
    initAccessibility();
}

export async function getPosts(
    chronological = false,
    postId = null
) {
    const data = await sendRequest({
        url: postId ?
            `/api/v1/posts/${postId}` :
            `/api/v1/posts/?chronological=${chronological}&skip=${postsState.skip}`,
    });

    if (!data.success) return Swal.fire(data.error);
    renderPosts(data.posts);
}

getPosts(postsState.chronological, postsState.customPostId);