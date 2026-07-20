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
    const visibilityEl = NS(NS.createEl("p", postCard, {
        style: "font-size: 15px;"
    })).html(`Is this post visible to public? <span style='color: green'>${post.private ? "No" : "Yes"}</span>`);

    if (isUsernameMatch) {
        const buttonGroup = NS.createEl("div", postCard, {
            className: "center-overflow"
        });

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
            id: "set-visibility-user-post-btn",
            style: "width: 100%"
        })).setText("Set visibility").on("click", async function () {
            const visibilityData = await NS.fetch({
                url: `/api/v1/set-visibility/post/${post._id}`,
                method: "POST",
                body: { value: !post.private }
            });

            if (!visibilityData.success) return Swal.fire(visibilityData.error);
            Swal.fire("Success", `Post visibility set as ${post.private ? "public" : "private"}!`, "success");
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
    };
}