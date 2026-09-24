import NS from "../nanoscript.min.js";
import { sendRequest, cleanHTML, generatePostLink, initLiveCounter, lockEvent } from "./helpers.js";

async function viewAnalytics(post) {
    Swal.fire({
        title: "Post analytics",
        html: "<div id='user-post-analytics-container' class='scroll-container'></div>",
        confirmButtonText: "Close",
        didOpen: () => {
            const postCard = NS.createEl("div", NS("#user-post-analytics-container"), { className: "card" });
            NS.createEl("h2", postCard, { className: "overflow" }).text(post.title);
            NS.createEl("div", postCard, {}).html(cleanHTML(post.content) || "Not content found");
            const panelAnalyticsGroup = NS.createEl("div", postCard, { className: "center-overflow" });
            const likesPercent = post.likes === 0 ? 0 : Math.min(100, Math.max(20, Math.floor(post.likes / 20) * 20));
            const barFilled = likesPercent === 100;

            // Quick analytics
            NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" }).text(`Likes: ${post.likes.toLocaleString()}`);
            NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" }).text(`Reports: ${post.reports.toLocaleString()}`);
            NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" }).text(`Comments: ${post.comments.toLocaleString()}`);
            NS.createEl("p", postCard, { style: "text-align: center" })
                .html(
                    barFilled ?
                        `You filled the bar! You're a <b>LEGEND!!</b>`
                        : `Fill the bar with 100 likes!`
                );

            // Likes bar
            NS.createEl("div", postCard, { className: "analytics-likes-bar" })
                .html("<div class='analytics-likes-bar-fill'></div>");
            NS(".analytics-likes-bar-fill").css("width", `${likesPercent}%`);

            if (!post.redeemed && barFilled) NS.createEl("button", postCard, { style: "width: 100%" }).text("One time redeem!").on("click", lockEvent(async function () {
                const redeemResponse = await sendRequest({
                    url: `/api/v1/redeem/post/${post._id}`,
                    method: "POST"
                });

                if (!redeemResponse.success) return Swal.fire(redeemResponse.error);
                Swal.fire("Success", `Redeemed successfully for ${redeemResponse.inc} extra post content chars. You must refresh the page for your new changes to apply.`, "success");
            }));
        }
    });
}

export async function renderProfilePost({
    post, isUserProfile, container
} = {}) {
    const postCard = NS.createEl("div", NS(container), { className: "card" });
    const postHeader = NS.createEl("div", postCard, { className: "space-between" });
    NS.createEl("h2", postHeader, { className: "overflow" }).text(post.title);

    // Copy
    NS.createEl("i", postHeader, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" }).on("click", async function () {
        NS.copy({
            text: generatePostLink(post._id),
            onSuccess: () => {
                Swal.fire("Success", "Copied!", "success")
            },

            onFailure: () => {
                Swal.fire("Error", "Failed to copy. Try again later", "error");
            }
        });
    });

    // Content
    NS.createEl("div", postCard, {}).html(cleanHTML(post.content) || "Not content found");

    // Status
    if (isUserProfile) {
        NS.createEl("p", postCard, {
            style: "font-size: 15px;"
        }).html(`Is this post visible to public? <span style='color: green'>${post.private ? "No" : "Yes"}</span>`);

        const primaryButtonsGroup = NS.createEl("div", postCard, { className: "center-overflow" });
        const secondaryButtonsGroup = NS.createEl("div", postCard, { className: "center-overflow" });

        /* Primary buttons */
        // Delete
        NS.createEl("button", primaryButtonsGroup, {
            id: "delete-user-post-btn",
            className: "btn-danger w-full"
        }).text("Delete").on("click", lockEvent(async function () {
            const deletedData = await sendRequest({
                url: `/api/v1/delete/post/${post._id}`,
                method: "DELETE"
            });

            if (!deletedData.success) return Swal.fire(deletedData.error);
            Swal.fire("Success", "Post deleted!", "success");
        }));

        // Edit
        NS.createEl("button", primaryButtonsGroup, {
            id: "edit-user-post-btn",
            className: "w-full"
        }).text("Edit").on("click", async function () {
            const result = await Swal.fire({
                title: "Update post: ",
                html: `
<input id="edit-post-title" type="text" placeholder="Enter new title...">
<input id="edit-post-keywords" type="text" placeholder="Enter new keyword (Comma-separated)...">
<textarea id="edit-post-content" placeholder="Enter new content"></textarea>
<p class="text-count">
  Count: <span class="count" id="edit-post-content-count">0</span>
</p>
                `,
                showCancelButton: true,
                didOpen: () => {
                    // Default values
                    NS("#edit-post-title").value(post.title);
                    NS("#edit-post-content").value(post.content);
                    NS("#edit-post-keywords").value(post.keywords.join(", "));
                    const maxPostLength = window?.quickInfo?.maxPostLength;
                    NS("#edit-post-content-count").text(`${NS("#edit-post-content").value().length}/${maxPostLength || 2000}`);

                    // Live counter
                    initLiveCounter("#edit-post-content", "#edit-post-content-count", maxPostLength);
                },
                preConfirm: () => {
                    const title = Swal.getPopup().querySelector("#edit-post-title").value;
                    const content = Swal.getPopup().querySelector("#edit-post-content").value;
                    const keywords = Swal.getPopup().querySelector("#edit-post-keywords").value.split(",").filter(Boolean).map(kw => kw.toLowerCase().trim());
                    const maxPostLength = window?.quickInfo?.maxPostLength || 2000;
                    if (!title || !content) return Swal.showValidationMessage("Don't forget the title and content!");
                    if (title.length > 20) return Swal.showValidationMessage("Title must be less than 20 chars!");
                    if (content.length > maxPostLength) return Swal.showValidationMessage(`Content must be less than ${maxPostLength} chars!`);
                    if (keywords.length > 5) return Swal.showValidationMessage("Keywords count should be less than 5!");

                    return { title, content, keywords };
                }
            });

            if (!result.isConfirmed) return;
            const editPostData = await sendRequest({
                url: `/api/v1/edit/post/${post._id}`,
                method: "PUT",
                body: {
                    newContent: result.value.content,
                    newTitle: result.value.title,
                    newKeywords: result.value.keywords
                }
            });

            if (!editPostData.success) return Swal.fire(editPostData.error);
            Swal.fire("Success", `Post updated!`, "success");
        });

        // Unpin/pin
        if (!post.private) NS.createEl("button", primaryButtonsGroup, {
            id: "pin-user-post-btn",
            className: "w-full"
        }).text(post.pinned ? "Unpin" : "Pin").on("click", async function () {
            const pinData = await sendRequest({
                url: `/api/v1/pin/post/${post._id}`,
                method: "POST",
                body: { value: !post.pinned }
            });

            if (!pinData.success) return Swal.fire(pinData.error);
            Swal.fire("Success", `Post ${post.pinned ? "unpinned" : "pinned"}!`, "success");
        });

        /* Secondary buttons */
        // Analytics
        NS.createEl("button", secondaryButtonsGroup, {
            id: "view-mini-analytics-post-btn",
            className: "w-full"
        }).text("View mini analytics").on("click", async function () {
            viewAnalytics(post);
        });

        // Change visibility
        if (!post.pinned) NS.createEl("button", secondaryButtonsGroup, {
            id: "change-visibility-user-post-btn",
            className: "w-full"
        }).text("Change visibility").on("click", async function () {
            const visibilityData = await sendRequest({
                url: `/api/v1/change-visibility/post/${post._id}`,
                method: "PUT",
                body: { value: !post.private } // Force a boolean
            });

            if (!visibilityData.success) return Swal.fire(visibilityData.error);
            Swal.fire("Success", `Post visibility set as ${post.private ? "public" : "private"}!`, "success");
        });
    }
}
