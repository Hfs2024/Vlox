import Editor from "./editor.js";
import showBookmarks from "./bookmarks.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    copy,
    initQuickInfo,
    initAccessibility,
    lockEvent,
    cleanHTML,
    generatePostLink,
    config,
    input,
    $
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

    $(state.container).html("");

    if (!Array.isArray(response.posts) || response.posts.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>No posts yet.</b>")
            .appendTo(state.container);
        return;
    }

    response.posts.forEach(post => {
        post = post || {};
        const postCard = $("<div>").addClass("card");
        const postHeader = $("<div>").addClass("space-between");
        $(state.container).append(postCard);
        postCard.append(postHeader);

        $("<h2>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(post.title) || "Untitled post")
            .appendTo(postHeader);

        $("<i>")
            .addClass("fas fa-link post-icon")
            .attr("role", "button")
            .attr("tabindex", "0")
            .on("click", async function () {
                copy(generatePostLink(post._id));
            })
            .appendTo(postHeader);

        $("<div>")
            .addClass("post-content")
            .html(cleanHTML(post.content) || "Not content found")
            .appendTo(postCard);

        // Actions
        if (state.isUser) {
            $("<p>")
                .css("font-size", "15px")
                .html(`Is this post visible to public? <span style='color: green'>${post.private ? "No" : "Yes"}</span>`)
                .appendTo(postCard);

            const buttonsContainer = $("<div>").addClass("center-overflow");
            postCard.append(buttonsContainer);

            $("<button>")
                .addClass("btn-danger w-full")
                .html("<i class='fas fa-trash'></i>")
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${post._id}/delete`,
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
                            endpoint: `/api/v1/posts/${post._id}/update`,
                            method: "PUT"
                        },
                    });

                    await editorInstance.init();
                }))
                .appendTo(buttonsContainer);

            $("<button>")
                .addClass("w-full")
                .html(`<i class='fas fa-${post.private ? "eye" : "eye-slash"}'></i>`)
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${post._id}/visibility`,
                        method: "PUT",
                        body: { value: !post.private }
                    });

                    if (!response.success) return Swal.fire(response.error);
                    Swal.fire("Success", `Post visibility set as ${post.private ? "public" : "private"}!`, "success");
                }))
                .appendTo(buttonsContainer);
        }
    });
}

export default async function showProfile(id) {
    state = {
        skip: 0,
        isUser: false,
        container: null,
        user: {}
    }

    // Show profile
    const response = await sendRequest({
        url: `/api/v1/users/${id}/profile`
    });

    if (!response.success) return Swal.fire(response.error);

    const user = response?.user || {};
    state.user = {
        username: capitalizeFirstLetter(user.username) || "User",
        bio: user.bio || "",
        private: user.private || false,
        id: user._id
    }
    state.isUser = window?.quickInfo?._id === state.user.id;

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
            state.container = $("#user-posts-container");

            $("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/users/recovery-codes",
                    method: "POST"
                });

                if (!response.success) return Swal.fire(response.error);

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
                initQuickInfo();
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
                await renderPosts();
            }));

            $("#profile-bookmarks-btn").on("click", lockEvent(async function () {
                await showBookmarks();
            }));

            $("#profile-posts-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            $("#profile-posts-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            initAccessibility();
        }
    });
}