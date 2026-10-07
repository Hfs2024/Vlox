import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import { sendRequest, capitalizeFirstLetter, initQuickInfo, initAccessibility, lockEvent, cleanHTML } from "./utils.js";
import { renderProfilePost } from "./render-profile-post.js";
import { getGifts } from "./gifts.js";

let state = {
    skip: 0,
    isUser: false,
    container: null,
    user: {}
}

const renderPosts = async () => {
    const response = await sendRequest({
        url: `/api/v1/get/user-posts/${state.user.id}/?skip=${state.skip}`
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
        renderProfilePost({
            post: post || {},
            isUser: state.isUser,
            container: NS("#user-posts-container")
        });
    });
}

// Show profile
export async function showProfile(id) {
    state = {
        skip: 0,
        isUser: false,
        container: null,
        user: {}
    }

    const response = await sendRequest({
        url: `/api/v1/get/user-profile/${id}`
    });

    if (!response.success) return Swal.fire(response.error);

    // Fields
    const user = response?.user || {};
    state.user = {
        username: capitalizeFirstLetter(user.username) || "User",
        emoji: user.emoji || config.EMOJIS[0],
        coins: user.coins || 0,
        bio: user.bio || "",
        private: user.private || false,
        id: user._id
    }
    state.isUser = window?.quickInfo?._id === state.user.id;

    // Render
    Swal.fire({
        titleText: `Hello, ${state.user.emoji} ${state.user.username}!`,
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
    <p><b>Coins:</b> ${state.user.coins}/${config.COINS_MAX}</p>
  ${state.isUser ? `
  <div class="center emoji-container"></div>

  <div class="center">
    <button id="view-gifts-btn" class="w-full">
       <i class="fas fa-gift"></i>
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
            const container = NS("#user-posts-container");
            state.container = container;

            NS("#view-gifts-btn").on("click", lockEvent(async function () {
                await getGifts();
            }));

            NS("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/reset/password/recovery-codes",
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
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("You must enter a new bio!");
                        if (result.length < config.BIO_MIN_LENGTH || result.length > config.BIO_MAX_LENGTH) return Swal.showValidationMessage(`Bio must be between ${config.BIO_MIN_LENGTH} and ${config.BIO_MAX_LENGTH} chars!`);
                    }
                });

                if (!result.isConfirmed) return;

                // Update bio
                const response = await sendRequest({
                    url: "/api/v1/update/user",
                    method: "PUT",
                    body: { newBio: result.value }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Bio updated!", "success");
                initQuickInfo();
            }));

            NS("#profile-visibility-toggle-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/change-visibility/user-profile",
                    method: "PUT",
                    body: { value: !state.user.private }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", `Account is ${state.user.private ? "public" : "private"}`, "success");
            }));

            NS("#profile-load-posts-btn").on("click", lockEvent(async function () {
                await renderPosts();
            }));

            NS("#profile-posts-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            NS("#profile-posts-next-btn").on("click", lockEvent(async function () {
                if (container.get(".state-nothing-found")?.elements) return;
                state.skip += config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            // Emojis
            if (state.isUser) {
                config.EMOJIS.forEach(emoji => {
                    NS.createEl("button", NS(".emoji-container"), { className: "emoji-container-btn" })
                        .text(emoji)
                        .on("click", lockEvent(async function () {
                            const response = await sendRequest({
                                url: "/api/v1/update/user",
                                method: "PUT",
                                body: { newEmoji: emoji }
                            });

                            if (!response.success) return Swal.fire(response.error);
                            return Swal.fire("Success", "Emoji successfully changed!", "success");
                        }));
                });
            }

            // Init
            initAccessibility();
        }
    });
}