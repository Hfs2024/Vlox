import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import Editor from "./editor.js";
import showGifts from "./gifts.js";
import showBookmarks from "./bookmarks.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    copy,
    initQuickInfo,
    initAccessibility,
    lockEvent,
    cleanHTML,
    generatePostLink
} from "./utils.js";

let state = {
    skip: 0,
    isUser: false,
    container: null,
    user: {}
}

async function renderPosts() {
    const response = await sendRequest({
        url: `/api/v1/users/${state.user.id}/posts/?skip=${state.skip}`
    });

    if (!response.success) return Swal.fire(response.error);

    // Render
    state.container.html(""); // Clear the container

    if (!Array.isArray(response.posts) || response.posts.length <= 0) {
        NS.createEl("div", state.container, { className: "state-nothing-found" })
            .html("<b>No posts yet.</b>");
        return;
    }

    response.posts.forEach(post => {
        post = post || {};
        const postCard = NS.createEl("div", state.container, { className: "card" });
        const postHeader = NS.createEl("div", postCard, { className: "space-between" });
        NS.createEl("h2", postHeader, { className: "overflow" }).text(capitalizeFirstLetter(post.title) || "Untitled post");

        // Copy
        NS.createEl("i", postHeader, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" })
            .on("click", async function () {
                copy(generatePostLink(post._id));
            });

        // Content
        NS.createEl("div", postCard, {}).html(cleanHTML(post.content) || "Not content found");

        // Actions
        if (state.isUser) {
            NS.createEl("p", postCard, { style: "font-size: 15px;" })
                .html(`Is this post visible to public? <span style='color: green'>${post.private ? "No" : "Yes"}</span>`);

            const buttonsContainer = NS.createEl("div", postCard, { className: "center-overflow" });

            NS.createEl("button", buttonsContainer, {
                className: "btn-danger w-full"
            })
                .html("<i class='fas fa-trash'></i>")
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${post._id}/delete`,
                        method: "DELETE"
                    });

                    if (!response.success) return Swal.fire(response.error);
                    Swal.fire("Success", "Post deleted!", "success");
                }));

            NS.createEl("button", buttonsContainer, {
                className: "w-full"
            })
                .html("<i class='fas fa-edit'></i>")
                .on("click", lockEvent(async function () {
                    const editorInstance = new Editor({
                        initial: post,
                        successMessage: "Post updated!",
                        title: "Update post: ",
                        api: {
                            endpoint: `/api/v1/posts/${post._id}/update`,
                            method: "PUT"
                        },
                    });

                    await editorInstance.start();
                }));

            NS.createEl("button", buttonsContainer, {
                className: "w-full"
            })
                .html(`<i class='fas fa-${post.private ? "eye" : "eye-slash"}'></i>`)
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${post._id}/visibility`,
                        method: "PUT",
                        body: { value: !post.private }
                    });

                    if (!response.success) return Swal.fire(response.error);
                    Swal.fire("Success", `Post visibility set as ${post.private ? "public" : "private"}!`, "success");
                }));
        }
    });
}

// Show profile
export default async function showProfile(id) {
    state = {
        skip: 0,
        isUser: false,
        container: null,
        user: {}
    }

    const response = await sendRequest({
        url: `/api/v1/users/${id}/profile`
    });

    if (!response.success) return Swal.fire(response.error);

    // Fields
    const user = response?.user || {};
    state.user = {
        username: capitalizeFirstLetter(user.username) || "User",
        bio: user.bio || "",
        private: user.private || false,
        id: user._id
    }
    state.isUser = window?.quickInfo?._id === state.user.id;

    // Render
    Swal.fire({
        titleText: `Hello, ${state.user.username}!`,
        html: `
<div class="card">
  <div class="space-between">
    <p class="center-overflow"><b>Bio:</b> ${cleanHTML(state.user.bio, false) || "No bio found"}</p>
    ${state.isUser ? '<i class="fas fa-pen-to-square icon-helper" id="profile-bio-edit-btn" role="button" tabindex="0"></i>' : ""}
  </div>
  <div class="space-between">  
    <p><b>Visibility:</b> ${state.user.private ? "Private" : "Public"}</p>
    ${state.isUser ? `<i class="fas fa-${state.user.private ? "eye" : "eye-slash"} icon-helper" id="profile-visibility-toggle-btn" role="button" tabindex="0"></i>` : ""}
  </div>
  ${state.isUser ? `
  <div class="center">
    <button id="profile-bookmarks-btn" class="w-full">
       <i class="fas fa-bookmark"></i>
    </button>

    <button id="reset-password-recovery-codes-btn" class="w-full">
      <i class="fas fa-arrow-left-rotate"></i>
    </button>
  </div>
` : ""}
</div>

<div id="user-posts-container" class="scroll-container">
  <button id="profile-load-posts-btn" class="w-full">
    <i class="fas fa-download"></i>
    Load Posts
  </button>
</div>

<div class="center" style="margin-top: 10px">
  <button id="profile-posts-prev-btn">
    <i class="fas fa-caret-left"></i>
  </button>
  <button id="profile-posts-next-btn">
    <i class="fas fa-caret-right"></i>
  </button>
</div>
        `,
        confirmButtonText: "Close",
        didOpen: () => {
            state.container = NS("#user-posts-container");

            NS("#view-gifts-btn").on("click", lockEvent(async function () {
                await showGifts();
            }));

            NS("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/users/recovery-codes",
                    method: "POST"
                });

                if (!response.success) return Swal.fire(response.error);

                // Download recovery codes
                const recoveryCodes = Array.isArray(response.codes) ? response.codes : [];
                const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                NS.createEl("a", document.body, {})
                    .attr("href", url)
                    .attr("download", "recovery-codes.txt")
                    .click()
                    .remove();
                Swal.fire("Success", "Password Recovery Codes Reseted!", "success");
            }));

            NS("#profile-bio-edit-btn").on("click", lockEvent(async function () {
                const result = await Swal.fire({
                    title: "Enter new bio: ",
                    input: "text",
                    inputPlaceholder: "Enter new bio...",
                    inputValue: state.user.bio,
                    inputAttributes: {
                        maxLength: config.BIO_MAX_LENGTH
                    },
                    showCancelButton: true,
                    preConfirm: result => {
                        if (result.length < config.BIO_MIN_LENGTH) return Swal.showValidationMessage(`Bio must be at least ${config.BIO_MIN_LENGTH} chars!`);
                    }
                });

                if (!result.isConfirmed) return;

                // Update bio
                const response = await sendRequest({
                    url: "/api/v1/me/bio",
                    method: "PUT",
                    body: { bio: result.value }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Bio updated!", "success");
                initQuickInfo();
            }));

            NS("#profile-visibility-toggle-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/me/visibility",
                    method: "PUT",
                    body: { value: !state.user.private }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", `Account is ${state.user.private ? "public" : "private"}`, "success");
            }));

            NS("#profile-load-posts-btn").on("click", lockEvent(async function () {
                await renderPosts();
            }));

            NS("#profile-bookmarks-btn").on("click", lockEvent(async function () {
                await showBookmarks();
            }));

            NS("#profile-posts-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            NS("#profile-posts-next-btn").on("click", lockEvent(async function () {
                if (state.container.get(".state-nothing-found")?.elements) return;
                state.skip += config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            // Init
            initAccessibility();
        }
    });
}