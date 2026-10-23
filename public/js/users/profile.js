import Editor from "../core/editor.js";
import showBookmarks from "../posts/bookmarks.js";
import templates from "../core/templates.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    copy,
    initAccessibility,
    lockEvent,
    renderSafeHtml,
    generatePostLink,
    config,
    input,
    $
} from "../core/utils.js";

async function renderPosts(state = {}) {
    const response = await sendRequest({
        url: `/api/v1/users/${state.user.id}/posts/?skip=${state.skip}`
    });

    if (!response.success) return Swal.fire(response.error);

    // Clear container
    $(state.container).empty("");

    // No data
    if (!Array.isArray(response.posts) || response.posts.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>No posts yet.</b>")
            .appendTo(state.container);
        return;
    }

    // Render data
    const fragment = new DocumentFragment();

    response.posts.forEach(post => {
        const safePost = post || {};
        const postCard = $("<div>").addClass("card");
        const postHeader = $("<div>").addClass("space-between").appendTo(postCard);

        // Header
        $("<h2>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(safePost.title) || "Untitled post")
            .appendTo(postHeader);

        $("<i>")
            .addClass("fas fa-link post-icon")
            .attr("role", "button")
            .attr("tabindex", "0")
            .on("click", async function () {
                copy(generatePostLink(safePost._id));
            })
            .appendTo(postHeader);

        // Content
        $("<div>")
            .addClass("post-content")
            .html(renderSafeHtml(safePost.content) || "Not content found")
            .appendTo(postCard);

        // Actions
        if (state.user.isLoggedInUser) {
            $("<small>")
                .css("color", "dimgray")
                .html(`(Private): <span style='color: green'>${safePost.private ? "No" : "Yes"}</span>`)
                .appendTo(postCard);

            const buttonsContainer = $("<div>").addClass("center-overflow");
            postCard.append(buttonsContainer);

            $("<button>")
                .addClass("btn-danger w-full")
                .html("<i class='fas fa-trash'></i>")
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${safePost._id}/delete`,
                        method: "DELETE"
                    });

                    if (!response.success) return Swal.fire(response.error);
                    Swal.fire("Success", "Post deleted!", "success");
                }))
                .appendTo(buttonsContainer);

            $("<button>")
                .addClass("w-full")
                .html("<i class='fas fa-edit'></i>")
                .on("click", lockEvent(async function () {
                    const editorInstance = new Editor({
                        initial: post,
                        successMessage: "Post updated!",
                        title: "Update post: ",
                        api: {
                            endpoint: `/api/v1/posts/${safePost._id}/update`,
                            method: "PUT"
                        },
                    });

                    await editorInstance.init();
                }))
                .appendTo(buttonsContainer);

            $("<button>")
                .addClass("w-full")
                .html(`<i class='fas fa-${safePost.private ? "eye" : "eye-slash"}'></i>`)
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${safePost._id}/visibility`,
                        method: "PUT",
                        body: { value: !safePost.private }
                    });

                    if (!response.success) return Swal.fire(response.error);
                    Swal.fire("Success", `Post visibility set as ${safePost.private ? "public" : "private"}!`, "success");
                }))
                .appendTo(buttonsContainer);
        }

        fragment.appendChild(postCard[0]);
    });

    $(state.container).append(fragment);
}

export default async function showProfile(id) {
    // Get data
    const response = await sendRequest({
        url: `/api/v1/users/${id}/profile`
    });

    if (!response.success) return Swal.fire(response.error);

    // Save user data temporarily
    const user = response.user || {};
    const state = {
        skip: 0,
        isLoggedInUser: false,
        container: null,
        user: {
            username: capitalizeFirstLetter(user.username) || "User",
            bio: user.bio || "",
            private: user.private || false,
            id: user._id,
            isLoggedInUser: user._id === window?.quickInfo?._id
        }
    }

    Swal.fire({
        titleText: `Hello, ${state.user.username}!`,
        html: templates.USER_PROFILE(state),
        confirmButtonText: "Close",
        didOpen: () => {
            state.container = $("#user-posts-container");

            $("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/users/recovery-codes",
                    method: "POST"
                });

                if (!response.success) return Swal.fire(response.error);

                // Download recovery codes
                const recoveryCodes = Array.isArray(response.codes) ? response.codes : [];
                const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                $("<a>")
                    .attr("href", url)
                    .attr("download", "recovery-codes.txt")
                    .appendTo(document.body)
                    .trigger("click")
                    .remove();

                Swal.fire("Success", "Password Recovery Codes Reseted!", "success");
            }));

            $("#profile-bio-edit-btn").on("click", lockEvent(async function () {
                const result = await input({
                    inputValue: state.user.bio || "",
                    inputAttributes: {
                        maxLength: config.BIO_MAX_LENGTH
                    },
                    preConfirm: result => {
                        if (result.length < config.BIO_MIN_LENGTH) return Swal.showValidationMessage(`Bio must be at least ${config.BIO_MIN_LENGTH} chars!`);
                    }
                });

                if (!result.isConfirmed) return;

                // Send request
                const response = await sendRequest({
                    url: "/api/v1/me/bio",
                    method: "PUT",
                    body: { bio: result.value }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Bio updated!", "success");
            }));

            $("#profile-visibility-toggle-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/me/visibility",
                    method: "PUT",
                    body: { value: !state.user.private }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", `Account is ${state.user.private ? "public" : "private"}`, "success");
            }));

            $("#profile-load-posts-btn").on("click", lockEvent(async function () {
                await renderPosts(state);
            }));

            $("#profile-bookmarks-btn").on("click", lockEvent(async function () {
                await showBookmarks();
            }));

            $("#profile-posts-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.USER_POSTS_LIMIT;
                await renderPosts(state);
            }));

            $("#profile-posts-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.USER_POSTS_LIMIT;
                await renderPosts(state);
            }));

            initAccessibility();
        }
    });
}