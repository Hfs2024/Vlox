import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import Editor from "./editor.js";
import {
    sendRequest,
    cleanHTML,
    generatePostLink,
    lockEvent,
    initQuickInfo
} from "./utils.js";

async function viewAnalytics(post = {}) {
    post = post || {};

    // Clean field
    const likes = Number(post.likes) || 0;
    const level = Number(post.level) || 1;

    // Likes percent
    const { POST_REDEEM_LIKES_REQUIRED, POST_REDEEM_PROGRESS_STEP_PERCENT } = config;
    const likesPercent = likes === 0 ? 0 : Math.min(100, Math.max(POST_REDEEM_PROGRESS_STEP_PERCENT, Math.floor(likes / POST_REDEEM_LIKES_REQUIRED * (100 / POST_REDEEM_PROGRESS_STEP_PERCENT)) * POST_REDEEM_PROGRESS_STEP_PERCENT));
    const barFilled = likesPercent === 100;

    Swal.fire({
        title: "Post analytics",
        html: "<div id='user-post-analytics-container' class='scroll-container'></div>",
        confirmButtonText: "Close",
        didOpen: () => {
            const postCard = NS.createEl("div", NS("#user-post-analytics-container"), { className: "card" });
            NS.createEl("h2", postCard, { className: "overflow" }).text(post.title || "No title found");
            NS.createEl("div", postCard, {}).html(cleanHTML(post.content) || "Not content found");
            const analyticsGroup = NS.createEl("div", postCard, { className: "center-overflow" });

            // Quick analytics
            NS.createEl("button", analyticsGroup, { className: "analytics-item w-full" }).text(`Likes: ${likes.toLocaleString()}`);
            NS.createEl("button", analyticsGroup, { className: "analytics-item w-full" }).text(`Level: ${level}`);
            NS.createEl("p", postCard, { style: "text-align: center" })
                .html(
                    barFilled ?
                        "You're a <b>LEGEND!!</b>"
                        : `Fill the bar with ${POST_REDEEM_LIKES_REQUIRED} likes!`
                );

            // Likes bar
            NS.createEl("div", postCard, { className: "analytics-likes-bar" })
                .html("<div class='analytics-likes-bar-fill'></div>");
            NS(".analytics-likes-bar-fill").css("width", `${likesPercent}%`);

            /* Buttons */
            const buttonsGroup = NS.createEl("div", postCard, { className: "center-overflow" });

            // Increase level
            if (level < config.POST_LEVEL_MAX && window?.quickInfo?.coins >= config.COINS_MIN) {
                NS.createEl("button", buttonsGroup, { style: "width: 100%" })
                    .text("Increase level")
                    .on("click", lockEvent(async function () {
                        const increaseLevelResponse = await sendRequest({
                            url: `/api/v1/inc-lvl/post/${post._id}`,
                            method: "POST"
                        });

                        if (!increaseLevelResponse.success) return Swal.fire(increaseLevelResponse.error);
                        Swal.fire("Success", "Post level increased!", "success");
                        await initQuickInfo();
                    }));
            }

            // Redeem
            if (!post.redeemed && barFilled) {
                NS.createEl("button", buttonsGroup, { style: "width: 100%" })
                    .text("Redeem")
                    .on("click", lockEvent(async function () {
                        const redeemResponse = await sendRequest({
                            url: `/api/v1/redeem/post/${post._id}`,
                            method: "POST"
                        });

                        if (!redeemResponse.success) return Swal.fire(redeemResponse.error);
                        Swal.fire("Success", `Redeemed successfully for ${redeemResponse.inc} coins! You'll be able to use this coins later.`, "success");
                    }));
            }
        }
    });
}

export default async function renderProfilePost({
    post = {},
    isUser = false,
    container
} = {}) {
    post = post || {};
    const postCard = NS.createEl("div", container, { className: "card" });
    const postHeader = NS.createEl("div", postCard, { className: "space-between" });
    NS.createEl("h2", postHeader, { className: "overflow" }).text(post.title || "Untitled post");

    // Copy
    NS.createEl("i", postHeader, { className: "fas fa-link icon-post", role: "button", tabIndex: "0" })
        .on("click", async function () {
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

    // Actions
    if (isUser) {
        NS.createEl("p", postCard, { style: "font-size: 15px;" })
            .html(`Is this post visible to public? <span style='color: green'>${post.private ? "No" : "Yes"}</span>`);

        const buttons = NS.createEl("div", postCard, { className: "center-overflow" });

        NS.createEl("button", buttons, {
            className: "btn-danger w-full"
        })
            .html("<i class='fas fa-trash'></i>")
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/delete/post/${post._id}`,
                    method: "DELETE"
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Post deleted!", "success");
            }));

        NS.createEl("button", buttons, {
            className: "w-full"
        })
            .html("<i class='fas fa-edit'></i>")
            .on("click", lockEvent(async function () {
                const editorInstance = new Editor({
                    initial: post,
                    successMessage: "Post updated!",
                    title: "Update post: ",
                    api: {
                        endpoint: `/api/v1/edit/post/${post._id}`,
                        method: "PUT"
                    },
                }, true);

                await editorInstance.start();
            }));

        NS.createEl("button", buttons, {
            className: "w-full"
        })
            .html("<i class='fas fa-chart-bar'></i>")
            .on("click", async function () {
                viewAnalytics(post);
            });

        NS.createEl("button", buttons, {
            className: "w-full"
        })
            .html(`<i class='fas fa-${post.private ? "eye" : "eye-slash"}'></i>`)
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/change-visibility/post/${post._id}`,
                    method: "PUT",
                    body: { value: !post.private }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", `Post visibility set as ${post.private ? "public" : "private"}!`, "success");
            }));
    }
}
