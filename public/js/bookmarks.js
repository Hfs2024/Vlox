NS("#post-bookmarks-btn").on("click", lockEvent(async function () {
    let skip = 0;
    let data = await NS.fetch({
        url: `/api/v1/get/bookmarks/?skip=${skip}`,
        method: "POST"
    });
    if (!data.success) return Swal.fire(data.error);

    Swal.fire({
        title: "Your bookmarks: ",
        html: `
<div id="user-bookmarks-container" class="scroll-container"></div>
<div class="center">
  <button id="user-bookmarks-prev-btn"> 
    <i class="fas fa-caret-left"></i>
  </button>
  <button id="user-bookmarks-next-btn">
    <i class="fas fa-caret-right"></i>
  </button>
</div>
        `,
        didOpen: () => {
            const container = NS("#user-bookmarks-container");

            // Bookmarks
            const renderBookmarks = () => {
                container.html("");

                if (!data.bookmarks || data.bookmarks.length <= 0) {
                    NS(NS.createEl("div", container, {
                        className: "state-nothing-found",
                    })).html("<b>You don't have any bookmarks yet.</b>");
                    return;
                }

                data.bookmarks.forEach(bookmark => {
                    const bookmarkCard = NS.createEl("div", container, { className: "card" });
                    const bookmarkHeader = NS.createEl("div", bookmarkCard, { className: "space-between" });
                    const buttonGroup = NS.createEl("div", bookmarkCard, { className: "center-overflow" });

                    // Header buttons
                    NS(NS.createEl("h2", bookmarkHeader, { className: "overflow" })).setText(capitalizeFirstLetter(bookmark.title));
                    NS(NS.createEl("i", bookmarkHeader, { className: "fas fa-eye icon-helper", role: "button", tabIndex: "0" })).on("click", lockEvent(async function () {
                        const postData = await NS.fetch({
                            url: `/api/v1/get/post/${bookmark.for}`
                        });

                        if (!postData.success) return Swal.fire(postData.error);
                        renderPosts(Array.isArray(postData.posts) ? postData.posts : [postData.posts]);
                        Swal.clickConfirm();
                    }));

                    // Main buttons
                    NS(NS.createEl("button", buttonGroup, { className: "btn-danger w-full" })).setText("Delete").on("click", lockEvent(async function () {
                        const deleteData = await NS.fetch({
                            url: `/api/v1/delete/bookmark/${bookmark._id}`,
                            method: "DELETE"
                        });

                        if (!deleteData.success) return Swal.fire(deleteData.error);
                        Swal.fire("Success", "Bookmark deleted!", "success");
                    }));

                    NS(NS.createEl("button", buttonGroup, { className: "w-full" })).setText("Rename").on("click", async function () {
                        const result = await Swal.fire({
                            title: "Enter new title: ",
                            input: "text",
                            inputPlaceholder: "Enter new title...",
                            showCancelButton: true,
                            preConfirm: result => {
                                if (!result) return Swal.showValidationMessage("Please enter title before proceeding!");
                                if (result.length > 20) return Swal.showValidationMessage("Title must be less than or equal to 20 chars!");
                            }
                        });

                        if (!result.isConfirmed) return;
                        const renameData = await NS.fetch({
                            url: `/api/v1/rename/bookmark/${bookmark._id}`,
                            method: "PUT",
                            body: { title: result.value }
                        });

                        if (!renameData.success) return Swal.fire(renameData.error);
                        Swal.fire("Success", "Bookmark renamed successfully!", "success");
                    });
                });
            }

            // Navigation
            NS("#user-bookmarks-prev-btn").on("click", lockEvent(async function () {
                if (skip <= 0) return;
                skip -= 10;

                data = await NS.fetch({
                    url: `/api/v1/get/bookmarks/?skip=${skip}`,
                    method: "POST"
                });

                renderBookmarks();
            }));

            NS("#user-bookmarks-next-btn").on("click", lockEvent(async function () {
                if (container.get(".state-nothing-found")[0]) return;
                skip += 10;

                data = await NS.fetch({
                    url: `/api/v1/get/bookmarks/?skip=${skip}`,
                    method: "POST"
                });

                renderBookmarks();
            }));

            // Init
            renderBookmarks();
            initAccessibility();
        },
        confirmButtonText: "Close"
    });
}));