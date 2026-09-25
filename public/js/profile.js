import NS from "../nanoscript.min.js";
import { sendRequest, capitalizeFirstLetter, getQuickInfo, initAccessibility, lockEvent, cleanHTML } from "./helpers.js";
import { renderProfilePost } from "./render-profile-post.js";

export async function showProfile(data) {
    // Profile code
    let skip = 0;
    const safeData = data || {};
    const user = safeData.user || {};
    const id = user._id;
    const username = capitalizeFirstLetter(user.username) || "User";
    const emoji = user.emoji || "🚀";
    const isUserProfile = window?.quickInfo?.username === user.username;
    const emojis = ["🚀", "👦🏻", "👧🏻", "🐣", "🏇🏻"];

    Swal.fire({
        titleText: `${isUserProfile ? `Ciao, ${emoji} ${username}!` : `${emoji} ${username}'s profile`}`,
        html: `
<div class="card">
  <div class="space-between">
    <p class="center-overflow"><b>Bio:</b> ${user.bio ? cleanHTML(user.bio) : "No bio found"}</p>
    ${isUserProfile ? '<i class="fas fa-pen-to-square icon-helper" id="user-profile-bio-edit" role="button" tabindex="0"></i>' : ""}
  </div>
  <div class="space-between">  
    <p class="center-overflow"><b>Visibility:</b> ${user.private ? "Private" : "Public"}</p>
    ${isUserProfile ? `<i class="fas fa-${user.private ? "eye" : "eye-slash"} icon-helper" id="user-profile-visibility-toggle" role="button" tabindex="0"></i>` : ""}
  </div>
  ${isUserProfile ? `
  <div class="center-overflow emoji-container"></div>
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

            /* Posts */
            // Public
            const renderPosts = async () => {
                // Data
                const latestData = await sendRequest({
                    url: `/api/v1/get/user-posts/${id}/?skip=${skip}`
                });

                if (!latestData.success) return Swal.fire(latestData.error);

                // Render
                container.html(""); // Clear the container
                const posts = Array.isArray(latestData.posts) ? latestData.posts : [];
                if (posts.length <= 0) {
                    NS.createEl("div", container, { className: "state-nothing-found" })
                        .html("<b>No posts yet.</b>");
                    return;
                }

                posts.forEach(post => {
                    renderProfilePost({
                        post: post || {},
                        isUserProfile: isUserProfile,
                        container: "#user-posts-container"
                    });
                });
            }

            // Reset password recovery codes
            NS("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
                const newCodesResponse = await sendRequest({
                    url: "/api/v1/reset/password/recovery-codes",
                    method: "POST"
                });

                if (!newCodesResponse.success) return Swal.fire(newCodesResponse.error);
                const recoveryCodes = Array.isArray(newCodesResponse.codes) ? newCodesResponse.codes : [];
                const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                NS.createEl("a", document.body, {})
                    .attr("href", url)
                    .attr("download", "recovery-codes.txt")
                    .click()
                    .remove();
                Swal.fire("Sucesss", "Password Recovery Codes Reseted!", "success");
            }));

            // Update bio and profile visibility
            NS("#user-profile-bio-edit").on("click", async function () {
                const result = await Swal.fire({
                    title: "Enter new bio: ",
                    input: "text",
                    inputPlaceholder: "Enter new bio...",
                    inputValue: user.bio || "",
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("You must enter a new bio!");
                        if (result.length < 5 || result.length > 20) return Swal.showValidationMessage("Bio must be between 5 and 20 chars!");
                    }
                });

                if (result.isConfirmed) {
                    const updateBioResponse = await sendRequest({
                        url: "/api/v1/update/user",
                        method: "PUT",
                        body: { newBio: result.value }
                    });

                    if (!updateBioResponse.success) return Swal.fire(updateBioResponse.error);
                    Swal.fire("Success", "Bio updated!", "success");
                    getQuickInfo();
                }
            });

            NS("#user-profile-visibility-toggle").on("click", lockEvent(async function () {
                const updatevisibilityResponse = await sendRequest({
                    url: "/api/v1/change-visibility/user-profile",
                    method: "PUT",
                    body: { value: !user.private }
                });

                if (!updatevisibilityResponse.success) return Swal.fire(updatevisibilityResponse.error);
                Swal.fire("Sucess", `Account is ${user.private ? "public" : "private"}`, "success");
            }));

            // Load user posts
            NS("#user-load-posts-btn").on("click", function () {
                renderPosts();
            });

            // Navigation
            NS("#user-posts-prev-btn").on("click", lockEvent(async function () {
                if (skip <= 0) return;
                skip -= 10;
                renderPosts();
            }));

            NS("#user-posts-next-btn").on("click", lockEvent(async function () {
                if (container.get(".state-nothing-found")?.elements) return;
                skip += 10;
                renderPosts();
            }));

            // Emojis
            if (isUserProfile) {
                emojis.forEach(emoji => {
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