async function viewAnalytics(post) {
    Swal.fire({
        title: "Post analytics",
        html: "<div id='user-post-analytics-container' class='scroll-container'></div>",
        confirmButtonText: "Close"
    });

    const postCard = NS.createEl("div", NS("#user-post-analytics-container"), { className: "post" });
    NS(NS.createEl("h2", postCard, { className: "overflow" })).setText(post.title);
    NS(NS.createEl("div", postCard, { className: "overflow" })).html(cleanHTML(post.content) || "Not content found");
    const panelAnalyticsGroup = NS.createEl("div", postCard, { className: "center-overflow" });
    const likesPercent = post.likes === 0 ? 0 : post.likes >= 100 ? 100 : post.likes >= 80 ? 80 : post.likes >= 60 ? 60 : post.likes >= 40 ? 40 : 20;
    const barFilled = likesPercent === 100;

    // Quick analytics
    NS(NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" })).setText(`Likes: ${post.likes.toLocaleString()}`);
    NS(NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" })).setText(`Reports: ${post.reports.toLocaleString()}`);
    NS(NS.createEl("button", panelAnalyticsGroup, { className: "analytics-item w-full" })).setText(`Comments: ${post.comments.toLocaleString()}`);
    NS(NS.createEl("p", postCard, { style: "text-align: center" }))
        .html(
            barFilled ?
                `You filled the bar! You're a <b>LEGEND!!</b>`
                : `Fill the bar with 100 likes!`
        );

    // Likes bar
    NS(NS.createEl("div", postCard, { className: "analytics-likes-bar" }))
        .html("<div class='analytics-likes-bar-fill'></div>");
    NS(".analytics-likes-bar-fill").css("width", `${likesPercent}%`);

    if (!post.redeemed && barFilled) NS(NS.createEl("button", postCard, { style: "width: 100%" })).setText("One time redeem!").on("click", lockEvent(async function () {
        const redeemResponse = await NS.fetch({
            url: `/api/v1/redeem/post/${post._id}`,
            method: "POST"
        });

        if (!redeemResponse.success) return Swal.fire(redeemResponse.error);
        Swal.fire("Success", `Redeemed successfully for ${redeemResponse.inc} extra post content chars. You must refresh the page for your new changes to apply.`, "success");
    }));
}

async function renderProfilePost({
    post, isUser, container
} = {}) {
    const postCard = NS.createEl("div", NS(container), { className: "post" });
    const postHeader = NS.createEl("div", postCard, { className: "space-between" });
    NS(NS.createEl("h2", postHeader, { className: "overflow" })).setText(post.title);
    NS(NS.createEl("i", postHeader, { className: "fas fa-link post-icon", role: "button", tabIndex: "0" })).on("click", async function () {
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
    NS(NS.createEl("div", postCard, { className: "overflow" })).html(cleanHTML(post.content) || "Not content found");

    if (isUser) {
        NS(NS.createEl("p", postCard, {
            style: "font-size: 15px;"
        })).html(`Is this post visible to public? <span style='color: green'>${post.private ? "No" : "Yes"}</span>`);

        const primaryButtonsGroup = NS.createEl("div", postCard, { className: "center-overflow" });
        const secondaryButtonsGroup = NS.createEl("div", postCard, { className: "center-overflow" });

        // Primary buttons
        NS(NS.createEl("button", primaryButtonsGroup, {
            id: "delete-user-post-btn",
            className: "delete-btn w-full"
        })).setText("Delete").on("click", lockEvent(async function () {
            const deletedData = await NS.fetch({
                url: `/api/v1/delete/post/${post._id}`,
                method: "DELETE"
            });

            if (!deletedData.success) return Swal.fire(deletedData.error);
            Swal.fire("Success", "Post deleted!", "success");
        }));

        NS(NS.createEl("button", primaryButtonsGroup, {
            id: "edit-user-post-btn",
            className: "w-full"
        })).setText("Edit").on("click", async function () {
            const result = await Swal.fire({
                title: "Update post: ",
                html: `
<div id="edit-container">
  <input id="edit-post-title" type="text" placeholder="Enter new title..." aria-label="Post Title">
  <input id="edit-post-keywords" type="text" placeholder="Enter new keyword (Separated by comma)..."
    aria-label="Keywords">
  <textarea id="edit-post-content" placeholder="Enter new content" aria-label="Post Content"></textarea>
</div>

<div id="edit-preview-container" class="post-preview center-overflow"></div>

<div class="space-between">
  <div class="center">
    <i id="edit-spoilers-btn" class="fa-solid fa-circle-exclamation helper-icon" role="button" tabindex="0"
      title="Spoilers" aria-label="Toggle Spoilers"></i>
    <i id="edit-preview-mode" class="fas fa-columns helper-icon" role="button" tabindex="0" title="Preview toggle"
      aria-label="Toggle Preview Mode"></i>
  </div>

  <p class="count-text-wrapper">
    Count: <span class="count" id="edit-post-content-count">0/2000</span>
  </p>
</div>
                `,
                showCancelButton: true,
                didOpen: () => {
                    const editSpoilersBtn = NS("#edit-spoilers-btn")
                    setUpPreview({
                        btn: NS("#edit-preview-mode"),
                        editContainer: NS("#edit-container"),
                        previewContainer: NS("#edit-preview-container"),
                        titleEl: NS("#edit-post-title"),
                        contentEl: NS("#edit-post-content")
                    });

                    setUpBtnToggle(editSpoilersBtn);
                    if (post.spoilers) editSpoilersBtn.addClass("active-color");

                    NS("#edit-post-title").setVal(post.title);
                    NS("#edit-post-content").setVal(post.content);
                    NS("#edit-post-keywords").setVal(post.keywords.join(", "));
                    NS("#edit-post-content-count").setText(`${NS("#edit-post-content").getVal()[0].length}/${window?.currentUserQuickInfo?.maxPostContentCharsLength || 2000}`);
                    setUpLiveCounter("#edit-post-content", "#edit-post-content-count", window?.currentUserQuickInfo?.maxPostContentCharsLength);
                },
                preConfirm: () => {
                    const title = Swal.getPopup().querySelector("#edit-post-title").value;
                    const content = Swal.getPopup().querySelector("#edit-post-content").value;
                    const keywords = Swal.getPopup().querySelector("#edit-post-keywords").value.split(",").filter(Boolean).map(kw => kw.toLowerCase().trim());
                    const maxPostContentCharsLength = window?.currentUserQuickInfo?.maxPostContentCharsLength || 2000;
                    if (!title || !content) return Swal.showValidationMessage("Don't forget the title and content!");
                    if (title.length > 20) return Swal.showValidationMessage("Title must be less than 20 chars!");
                    if (content.length > maxPostContentCharsLength) return Swal.showValidationMessage(`Content must be less than ${maxPostContentCharsLength} chars!`);
                    if (keywords.length > 5) return Swal.showValidationMessage("Keywords count should be less than 5!");

                    return { title, content, keywords };
                }
            });

            if (!result.isConfirmed) return;
            const editPostData = await NS.fetch({
                url: `/api/v1/edit/post/${post._id}`,
                method: "PUT",
                body: {
                    newContent: result.value.content,
                    newTitle: result.value.title,
                    newKeywords: result.value.keywords,
                    newSpoilers: NS("#edit-spoilers-btn").hasClass("active-color")
                }
            });

            if (!editPostData.success) return Swal.fire(editPostData.error);
            Swal.fire("Success", `Post updated!`, "success");
        });

        if (!post.private) NS(NS.createEl("button", primaryButtonsGroup, {
            id: "pin-user-post-btn",
            className: "w-full"
        })).setText(post.pinned ? "Unpin" : "Pin").on("click", async function () {
            const pinData = await NS.fetch({
                url: `/api/v1/pin/post/${post._id}`,
                method: "POST",
                body: { value: !post.pinned }
            });

            if (!pinData.success) return Swal.fire(pinData.error);
            getQuickInfo();
            Swal.fire("Success", `Post ${post.pinned ? "unpinned" : "pinned"}!`, "success");
        });

        // Secondary buttons
        NS(NS.createEl("button", secondaryButtonsGroup, {
            id: "view-mini-analytics-post-btn",
            className: "w-full"
        })).setText("View mini analytics").on("click", async function () {
            viewAnalytics(post);
        });

        if (!post.pinned) NS(NS.createEl("button", secondaryButtonsGroup, {
            id: "change-visibility-user-post-btn",
            className: "w-full"
        })).setText("Change visibility").on("click", async function () {
            const visibilityData = await NS.fetch({
                url: `/api/v1/change-visibility/post/${post._id}`,
                method: "PUT",
                body: { value: !post.private } // Force a boolean
            });

            if (!visibilityData.success) return Swal.fire(visibilityData.error);
            Swal.fire("Success", `Post visibility set as ${post.private ? "public" : "private"}!`, "success");
        });
    }
}
