async function viewAnalytics(post) {
    Swal.fire({
        title: post.title,
        html: "<div id='user-post-analytics-container'></div>"
    });

    const postCard = NS.createEl("div", NS("#user-post-analytics-container"), { className: "post" });
    const titleEl = NS.createEl("h2", postCard, {});
    titleEl.textContent = decodeHTML(post.title);
    const contentEl = NS.createEl("p", postCard, {});
    contentEl.textContent = decodeHTML(post.content);
    const panelAnalyticsGroup = NS.createEl("div", postCard, { className: "center-overflow" });
    let likesPercent = 10;
    if (post.likes === 0) likesPercent = 0;
    else if (post.likes >= 100) likesPercent = 100;
    else if (post.likes >= 80) likesPercent = 80;
    else if (post.likes >= 60) likesPercent = 60;
    else if (post.likes >= 40) likesPercent = 40;
    else if (post.likes >= 20) likesPercent = 20;

    // Quick analytics
    NS(NS.createEl("div", panelAnalyticsGroup, { className: "analytics-item" })).setText(`Likes: ${post.likes}`);
    NS(NS.createEl("div", panelAnalyticsGroup, { className: "analytics-item" })).setText(`Reports: ${post.reports}`);
    NS(NS.createEl("div", panelAnalyticsGroup, { className: "analytics-item" })).setText(`Comments: ${post.comments}`);
    NS(NS.createEl("p", postCard, { style: "text-align: center" }))
        .html(
            likesPercent === 100 ?
                `You filled the bar! You are a <span style='color: goldenrod'><b>LEGEND</b></span>`
                : `Fill the bar and be a LEGEND!`
        );

    // Likes bar
    NS(NS.createEl("div", postCard, { className: "analytics-likes-bar" }))
        .html("<div class='analytics-likes-bar-fill'></div>");
    NS(".analytics-likes-bar-fill").css({
        width: `${likesPercent}%`
    });
}

async function renderProfilePost({
    post, pinnedPosts, isUsernameMatch, container
} = {}) {
    if (!Array.isArray(pinnedPosts)) return console.log("Invalid 'pinnedPosts'");
    if (!post) return;
    const isPinned = pinnedPosts.find(p => p === post._id);
    const postCard = NS.createEl("div", NS(container), { className: "post" });
    const titleEl = NS.createEl("h2", postCard, {});
    titleEl.textContent = decodeHTML(post.title);
    const contentEl = NS.createEl("p", postCard, {});
    contentEl.textContent = decodeHTML(post.content);

    if (isUsernameMatch) {
        const visibilityEl = NS(NS.createEl("p", postCard, {
            style: "font-size: 15px;"
        })).html(`Is this post visible to public? <span style='color: green'>${post.private ? "No" : "Yes"}</span>`);

        const buttonGroup = NS.createEl("div", postCard, { className: "center-overflow" });
        const buttonGroup2 = NS.createEl("div", postCard, { className: "center-overflow" });

        NS(NS.createEl("button", buttonGroup, {
            id: "delete-user-post-btn",
            className: "delete-btn"
        })).setText("Delete").on("click", async function () {
            const deletedData = await NS.fetch({
                url: `/api/v1/delete/post/${post._id}`,
                method: "DELETE"
            });

            if (!deletedData.success) return Swal.fire(deletedData.error);
            Swal.fire("Success", "Post deleted!", "success");
        });

        NS(NS.createEl("button", buttonGroup, {
            id: "pin-user-post-btn",
            style: "width: 100%"
        })).setText(isPinned ? "Unpin" : "Pin").on("click", async function () {
            const pinData = await NS.fetch({
                url: `/api/v1/${isPinned ? "unpin" : "pin"}/post/${post._id}`,
                method: "POST",
                body: { value: !post.pinned }
            });

            if (!pinData.success) return Swal.fire(pinData.error);
            getQuickInfo();
            Swal.fire("Success", `Post ${isPinned ? "unpinned" : "pinned"}!`, "success");
        });

        NS(NS.createEl("button", buttonGroup, {
            id: "edit-user-post-btn",
            style: "width: 100%"
        })).setText("Edit").on("click", async function () {
            Swal.fire({
                title: "Enter new content: ",
                input: "textarea",
                inputPlaceholder: "Enter new content...",
                showCancelButton: true,
                preConfirm: result => {
                    if (!result) return Swal.showValidationMessage("You didn't enter any content!");
                    if (result.length > 2000) return Swal.showValidationMessage("Content must be less than 2000 chars!")
                }
            }).then(async result => {
                if (result.value && result.isConfirmed) {
                    const editPostData = await NS.fetch({
                        url: `/api/v1/edit/post/${post._id}`,
                        method: "PUT",
                        body: { newContent: result.value }
                    });

                    if (!editPostData.success) return Swal.fire(editPostData.error);
                    getQuickInfo();
                    Swal.fire("Success", `Post updated!`, "success");
                }
            });
        });

        changeVisibility({
            value: !post.private,
            buttonText: "Change visibility",
            container: buttonGroup2,
            postId: post._id
        });

        NS(NS.createEl("button", buttonGroup2, {
            id: "view-mini-analytics-post-btn",
            style: "width: 100%"
        })).setText("View mini analytics").on("click", async function () {
            viewAnalytics(post);
        });
    };
}