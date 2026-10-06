import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import { sendRequest, capitalizeFirstLetter, getQuickInfo, initAccessibility, lockEvent, cleanHTML } from "./helpers.js";
import { renderProfilePost } from "./render-profile-post.js";

const data = {
    skip: 0,
    isUser: false,
    container: null,
    user: {}
}

const renderPosts = async () => {
    // Data
    const response = await sendRequest({
        url: `/api/v1/get/user-posts/${data.user.id}/?skip=${data.skip}`
    });

    if (!response.success) return Swal.fire(response.error);

    // Render
    data.container.html(""); // Clear the container

    if (!Array.isArray(response.posts) || response.posts.length <= 0) {
        NS.createEl("div", data.container, { className: "state-nothing-found" })
            .html("<b>No posts yet.</b>");
        return;
    }

    response.posts.forEach(post => {
        renderProfilePost({
            post: post || {},
            isUser: data.isUser,
            container: NS("#user-posts-container")
        });
    });
}

// Show profile
export async function showProfile(id) {
    // Data
    const response = await sendRequest({
        url: `/api/v1/get/user-profile/${id}`
    });

    if (!response.success) return Swal.fire(response.error);

    // Fields
    const user = response?.user || {};
    data.user = {
        username: capitalizeFirstLetter(user.username) || "User",
        emoji: user.emoji || config.EMOJIS[0],
        coins: user.coins || 0,
        bio: user.bio || "",
        private: user.private || false,
        id: user._id
    }
    data.isUser = window?.quickInfo?._id === data.user.id;

    // Render
    Swal.fire({
        titleText: `Hello, ${data.user.emoji} ${data.user.username}!`,
        html: `
<div class="card">
  <div class="space-between">
    <p class="center-overflow"><b>Bio:</b> ${cleanHTML(data.user.bio, false) || "No bio found"}</p>
    ${data.isUser ? '<i class="fas fa-pen-to-square icon-helper" id="user-profile-bio-edit-btn" role="button" tabindex="0"></i>' : ""}
  </div>
  <div class="space-between">  
    <p><b>Visibility:</b> ${data.user.private ? "Private" : "Public"}</p>
    ${data.isUser ? `<i class="fas fa-${data.user.private ? "eye" : "eye-slash"} icon-helper" id="user-profile-visibility-toggle-btn" role="button" tabindex="0"></i>` : ""}
  </div>
    <p><b>Coins:</b> ${data.user.coins}/${config.COINS_MAX}</p>
  ${data.isUser ? `
  <div class="center emoji-container"></div>
  <button id="reset-password-recovery-codes-btn" class="w-full">Reset Recovery Codes</button>
` : ""}
</div>

<div id="user-posts-container" class="scroll-container">
  <button id="user-load-posts-btn" class="w-full">
    <i class="fas fa-download"></i>
    Load Posts
  </button>
</div>

<div class="center" style="margin-top: 10px">
  <button id="user-posts-prev-btn">
    <i class="fas fa-caret-left"></i>
  </button>
  <button id="user-posts-next-btn">
    <i class="fas fa-caret-right"></i>
  </button>
</div>
        `,
        confirmButtonText: "Close",
        didOpen: () => {
            const container = NS("#user-posts-container");
            data.container = container;

            // Reset password recovery codes
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

            // Update bio and profile visibility
            NS("#user-profile-bio-edit-btn").on("click", lockEvent(async function () {
                const result = await Swal.fire({
                    title: "Enter new bio: ",
                    input: "text",
                    inputPlaceholder: "Enter new bio...",
                    inputValue: data.bio,
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
                getQuickInfo();
            }));

            NS("#user-profile-visibility-toggle-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/change-visibility/user-profile",
                    method: "PUT",
                    body: { value: !data.private }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", `Account is ${data.private ? "public" : "private"}`, "success");
            }));

            // Load user posts
            NS("#user-load-posts-btn").on("click", lockEvent(async function () {
                await renderPosts();
            }));

            // Navigation
            NS("#user-posts-prev-btn").on("click", lockEvent(async function () {
                if (data.skip <= 0) return;
                data.skip -= config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            NS("#user-posts-next-btn").on("click", lockEvent(async function () {
                if (container.get(".state-nothing-found")?.elements) return;
                data.skip += config.USER_POSTS_LIMIT;
                await renderPosts();
            }));

            // Emojis
            if (data.isUser) {
                config.EMOJIS.forEach(emoji => {
                    NS.createEl("button", NS(".emoji-container"), { className: "btn-emoji-container" })
                        .text(emoji)
                        .on("click", lockEvent(async function () {
                            const updateEmojiResponse = await sendRequest({
                                url: "/api/v1/update/user",
                                method: "PUT",
                                body: { newEmoji: emoji }
                            });

                            if (!updateEmojiResponse.success) return Swal.fire(updateEmojidata.error);
                            return Swal.fire("Success", "Emoji successfully changed!", "success");
                        }));
                });
            }

            // Init
            initAccessibility();
        }
    });
}