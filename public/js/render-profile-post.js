import NS from "../nanoscript.min.js";
import { sendRequest, cleanHTML, generatePostLink, initLiveCounter, lockEvent } from "./helpers.js";

async function viewAnalytics(post = {}) {
    const safePost = post || {};
    const likes = Number(safePost.likes ?? 0);
    const reports = Number(safePost.reports ?? 0);
    const comments = Number(safePost.comments ?? 0);
    const likesPercent = likes === 0 ? 0 : Math.min(100, Math.max(20, Math.floor(likes / 20) * 20));
    const barFilled = likesPercent === 100;

    Swal.fire({
        title: "Post analytics",
        html: "<div id='user-post-analytics-container' class='scroll-container'></div>",
        confirmButtonText: "Close",
        didOpen: () => {
            const postCard = NS.createEl("div", NS("#user-post-analytics-container"), { className: "card" });
            NS.createEl("h2", postCard, { className: "overflow" }).text(safePost.title || "No title found");
            NS.createEl("div", postCard, {}).html(cleanHTML(safePost.content || "") || "Not content found");
            const panelAnalyticsGroup = NS.createEl("div", postCard, { className: "center-overflow" });

            // Quick analytics
            NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" }).text(`Likes: ${likes.toLocaleString()}`);
            NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" }).text(`Reports: ${reports.toLocaleString()}`);
            NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" }).text(`Comments: ${comments.toLocaleString()}`);
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

            if (!safePost.redeemed && barFilled) NS.createEl("button", postCard, { style: "width: 100%" })
                .text("Click here for one time redeem")
                .on("click", lockEvent(async function () {
                    const redeemResponse = await sendRequest({
                        url: `/api/v1/redeem/post/${safePost._id}`,
                        method: "POST"
                    });

                    if (!redeemResponse.success) return Swal.fire(redeemResponse.error);
                    Swal.fire("Success", `Redeemed successfully for ${redeemResponse.inc} extra post content chars. You must refresh the page for your new changes to apply.`, "success");
                }));
        }
    });
}

export async function renderProfilePost({
    post = {}, isUserProfile = false, container = ""
} = {}) {
    const safePost = post || {};
    const safeKeywords = Array.isArray(safePost.keywords) ? safePost.keywords : [];
    const postCard = NS.createEl("div", NS(container), { className: "card" });
    const postHeader = NS.createEl("div", postCard, { className: "space-between" });
    NS.createEl("h2", postHeader, { className: "overflow" }).text(safePost.title || "Untitled post");

    // Copy
    NS.createEl("i", postHeader, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" })
        .on("click", async function () {
            NS.copy({
                text: generatePostLink(safePost._id || ""),
                onSuccess: () => {
                    Swal.fire("Success", "Copied!", "success")
                },

                onFailure: () => {
                    Swal.fire("Error", "Failed to copy. Try again later", "error");
                }
            });
        });

    // Content
    NS.createEl("div", postCard, {}).html(cleanHTML(safePost.content) || "Not content found");

    // Status
    if (isUserProfile) {
        NS.createEl("p", postCard, {
            style: "font-size: 15px;"
        }).html(`Is this post visible to public? <span style='color: green'>${safePost.private ? "No" : "Yes"}</span>`);

        const primaryButtonsGroup = NS.createEl("div", postCard, { className: "center-overflow" });
        const secondaryButtonsGroup = NS.createEl("div", postCard, { className: "center-overflow" });

        /* Primary buttons */
        // Delete
        NS.createEl("button", primaryButtonsGroup, {
            id: "delete-user-post-btn",
            className: "btn-danger w-full"
        }).text("Delete").on("click", lockEvent(async function () {
            const deletedData = await sendRequest({
                url: `/api/v1/delete/post/${safePost._id}`,
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
                    NS("#edit-post-title").value(safePost.title || "");
                    NS("#edit-post-content").value(safePost.content || "");
                    NS("#edit-post-keywords").value(safeKeywords.join(", "));
                    const maxPostLength = window?.quickInfo?.maxPostLength || 2000;
                    NS("#edit-post-content-count").text(`${(NS("#edit-post-content").value()).length}`);

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
                url: `/api/v1/edit/post/${safePost._id}`,
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

        /* Secondary buttons */
        // Analytics
        NS.createEl("button", secondaryButtonsGroup, {
            id: "view-mini-analytics-post-btn",
            className: "w-full"
        }).text("View mini analytics").on("click", async function () {
            viewAnalytics(safePost);
        });

        // Change visibility
        NS.createEl("button", secondaryButtonsGroup, {
            id: "change-visibility-user-post-btn",
            className: "w-full"
        }).text("Change visibility").on("click", async function () {
            const visibilityData = await sendRequest({
                url: `/api/v1/change-visibility/post/${safePost._id}`,
                method: "PUT",
                body: { value: !safePost.private } // Force a boolean
            });

            if (!visibilityData.success) return Swal.fire(visibilityData.error);
            Swal.fire("Success", `Post visibility set as ${safePost.private ? "public" : "private"}!`, "success");
        });
    }
}
