NS("#post-bookmarks-btn").on("click", async function () {
    let bookmarksSkip = 0;
    let bookmarksPosts = await NS.fetch({
        url: `/api/v1/get/bookmarks/?skip=${bookmarksSkip}`,
        method: "POST"
    });
    if (!bookmarksPosts.success) return Swal.fire(bookmarksPosts.error);

    Swal.fire({
        title: "Your bookmarks: ",
        html: `
          <div id='user-bookmarks-container' class='scroll-container'></div>
          <div class='center'>
            <button id='user-bookmarks-prev-btn'> 
               <i class='fas fa-caret-left'></i>
            </button>
            <button id='user-bookmarks-next-btn'>
               <i class='fas fa-caret-right'></i>
            </button>
          </div>
        `,
        confirmButtonText: "Close"
    });

    const container = NS("#user-bookmarks-container");

    const renderBookmarks = () => {
        container.html("");

        if (!bookmarksPosts.posts || bookmarksPosts.posts.length <= 0) {
            NS(NS.createEl("div", container, {
                className: "nothing-found",
            })).html("<b>You don't have any bookmarks yet.</b>");
            return;
        }

        bookmarksPosts.posts.forEach((bookmark, index) => {
            const bookmarkCard = NS.createEl("div", container, { className: "bookmark" });
            const bookmarkHeader = NS.createEl("div", bookmarkCard, { className: "space-between" });
            const buttonGroup = NS.createEl("div", bookmarkCard, { className: "center-overflow" });

            // Header buttons
            NS(NS.createEl("h2", bookmarkHeader, { className: "overflow" })).setText(capitalizeFirstLetter(bookmark.title) || `Bookmark ${index + 1}`);
            NS(NS.createEl("i", bookmarkHeader, { className: "fas fa-eye helper-icon", role: "button", tabIndex: "0" })).on("click", async function () {
                const postResponse = await NS.fetch({
                    url: `/api/v1/get/post/${bookmark.for}`
                });

                if (!postResponse.success) return Swal.fire(postResponse.error);
                renderPosts(Array.isArray(postResponse.posts) ? postResponse.posts : [postResponse.posts]);
                Swal.clickConfirm();
            });

            // Main buttons
            NS(NS.createEl("button", buttonGroup, { className: "delete-btn w-full" })).setText("Delete").on("click", async function () {
                const deleteResponse = await NS.fetch({
                    url: `/api/v1/delete/bookmark/${bookmark._id}`,
                    method: "DELETE"
                });

                if (!deleteResponse.success) return Swal.fire(deleteResponse.error);
                Swal.fire("Success", "Bookmark deleted!", "success");
            });

            NS(NS.createEl("button", buttonGroup, { className: "w-full" })).setText("Rename").on("click", function () {
                Swal.fire({
                    title: "Enter new title: ",
                    input: "text",
                    inputPlaceholder: "Enter new title...",
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("Please enter title before proceeding!");
                        if (result.length > 20) return Swal.showValidationMessage("Title must be less than or equal to 20 chars!");
                    }
                }).then(async result => {
                    if (result.value && result.isConfirmed) {
                        const renameResponse = await NS.fetch({
                            url: `/api/v1/rename/bookmark/${bookmark._id}`,
                            method: "PUT",
                            body: { title: result.value }
                        });

                        if (!renameResponse.success) return Swal.fire(renameResponse.error);
                        Swal.fire("Success", "Bookmark renamed successfully!", "success");
                    }
                });
            });
        });
    }

    // Navigation
    NS("#user-bookmarks-prev-btn").on("click", async function () {
        if (bookmarksSkip <= 0) return;
        bookmarksSkip -= 10;

        bookmarksPosts = await NS.fetch({
            url: `/api/v1/get/bookmarks/?skip=${bookmarksSkip}`,
            method: "POST"
        });

        renderBookmarks();
    });

    NS("#user-bookmarks-next-btn").on("click", async function () {
        if (container.get(".nothing-found")[0]) return;
        bookmarksSkip += 10;

        bookmarksPosts = await NS.fetch({
            url: `/api/v1/get/bookmarks/?skip=${bookmarksSkip}`,
            method: "POST"
        });

        renderBookmarks();
    });

    renderBookmarks();
    runAccessibility();
});