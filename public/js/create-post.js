const createPostBtn = NS("#create-post-btn");
const createPostContent = NS("#create-post-content");
const createPostTitle = NS("#create-post-title");
const copyPostContentBtn = NS("#copy-post-content-btn");
const prevBtn = NS("#prev-btn");
const nextBtn = NS("#next-btn");

// Bookmarks
async function showBookMarks() {
    let response = await NS.fetch({
        url: "/api/get/user-bookmarks"
    });
    const bookmarksIds = response.bookmarks.map(bookmark => bookmark.postId);
    const bookmarksPosts = await NS.fetch({
        url: "/api/get/bookmarks/posts",
        method: "POST",
        body: { ids: bookmarksIds }
    });
    let bookmarksSkip = 0;

    Swal.fire({
        title: "Your bookmarks: ",
        html: `
          <div id='user-bookmarks-container'></div>
          <div class='group'>
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

    const renderBookmarks = () => {
        NS("#user-bookmarks-container").html("");

        if (!response.bookmarks || response.bookmarks.length <= 0) {
            const noBookmarksFound = NS.createEl("h2", NS("#user-bookmarks-container"), {
                className: "nothing-found",
                style: "text-align: center"
            });
            noBookmarksFound.textContent = "You don't have any bookmarks yet.";
            return;
        }

        response.bookmarks.forEach((bookmark, index) => {
            const post = bookmarksPosts.posts[index];
            const bookmarkCard = NS.createEl("div", NS("#user-bookmarks-container"), { className: "bookmark" });
            NS(NS.createEl("h2", bookmarkCard, {})).setText(capitalizeFirstLtter(decodeHTML(bookmark.title)) || `Bookmark ${index + 1}`);
            const buttonGroup = NS.createEl("div", bookmarkCard, { className: "center-overflow" });
            NS(NS.createEl("button", buttonGroup, {})).setText("Delete bookmark").addClass("delete-btn").on("click", async function () {
                const deleteResponse = await NS.fetch({
                    url: `/api/v1/delete/bookmark/${bookmark._id}`,
                    method: "DELETE"
                });

                if (!deleteResponse.success) return Swal.fire(deleteResponse.error);
                Swal.fire("Success", "Bookmark deleted!", "success");
            });

            NS(NS.createEl("button", buttonGroup, {})).setText("Rename bookmark").css({ width: "100%" }).on("click", function () {
                Swal.fire({
                    title: "Enter new title: ",
                    input: "text",
                    inputPlaceholder: "Enter new title...",
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("Please enter title before proceeding!")
                    }
                }).then(async result => {
                    if (result.value && result.isConfirmed) {
                        const renameResponse = await NS.fetch({
                            url: `/api/v1/rename/bookmark/${bookmark._id}`,
                            method: "POST",
                            body: { title: result.value }
                        });

                        if (!renameResponse.success) return Swal.fire(renameResponse.error);
                        Swal.fire("Success", "Bookmark renamed successfully!", "success");
                    }
                });
            });

            NS(NS.createEl("button", buttonGroup, {})).setText("View bookmark").css({ width: "100%" }).on("click", function () {
                if (!post) return Swal.fire("Failure", "Something went wrong or post deleted", "error");
                renderPosts([post]);
                Swal.clickConfirm();
            });
        });
    }

    NS("#user-bookmarks-prev-btn").on("click", async function () {
        if (bookmarksSkip <= 0) return;
        bookmarksSkip -= 10;

        response = await NS.fetch({
            url: `/api/get/user-bookmarks/?skip=${bookmarksSkip}`
        });

        renderBookmarks();
    });

    NS("#user-bookmarks-next-btn").on("click", async function () {
        if (NS("#user-bookmarks-container").get(".nothing-found")[0]) return;
        bookmarksSkip += 10;

        response = await NS.fetch({
            url: `/api/get/user-bookmarks/?skip=${bookmarksSkip}`
        });

        renderBookmarks();
    });

    renderBookmarks();
}

NS("#post-bookmarks-btn").on("click", function () {
    showBookMarks();
});

// Ghost state (Auto save)
function clearGhostState() {
    NS("#create-post-content-count").setText("0/2000");
    NS.clearGhostState("#create-post-title", () => {
        createPostTitle.setVal("");
    });
    NS.clearGhostState("#create-post-content", () => {
        createPostContent.setVal("");
    });
}

NS.getGhostState();
NS.ghostState("#create-post-title", "value");
NS.ghostState("#create-post-content", "value");
NS("#create-post-content-count").setText(`${createPostContent.getVal()[0].length}/2000`);
NS("#clear-post-content-btn").on("click", function () {
    clearGhostState();
    Swal.fire("Success!", "Draft cleared!", "success");
});

// Init live counter
NS.liveCounter({
    element: "#create-post-content",
    counterElement: "#create-post-content-count",
    showCounter: true,
    max: 2000,
    runVisualFeedback: true,
    visualFeedback: [
        { value: 499, class: "count-yellow", addTo: ["#create-post-content"] },
        { value: 999, class: "count-orange", addTo: ["#create-post-content"] },
        { value: 1499, class: "count-red", addTo: ["#create-post-content"] },
        { value: 1999, class: "count-darkred", addTo: ["#create-post-content"] }
    ],
    onLimit: () => {
        Swal.fire("You have reached the limit of 2000 chars!");
    }
});

// Copy post content
copyPostContentBtn.on("click", function () {
    if (!createPostContent.getVal()[0]) return Swal.fire("There is no content to copy!");

    NS.copy({
        text: createPostContent.getVal()[0],
        onSuccess: () => { Swal.fire("Success", "Copied!", "success") },
        onFailure: () => { Swal.fire("Failed", "Failed to copy. Try again", "error") }
    });
});

// Create post
createPostBtn.on("click", async function () {
    const title = createPostTitle.getVal()[0]?.trim();
    const content = createPostContent.getVal()[0]?.trim();

    if (!title || !content) {
        Swal.fire("Title and content are required!");
        return;
    }

    await createPost({
        title: title,
        content: content
    });

    // Reset
    clearGhostState();
    getPosts();
});

async function createPost({ title, content } = {}) {
    const mentions = content.match(/@[a-zA-Z0-9_]+/g) || [];
    if (title.length > 20 || content.length > 2000) return Swal.fire("Title must be less than 20 chars and content should be less than 1000 chars");

    try {
        const data = await NS.fetch({
            url: "/api/v1/posts",
            method: "POST",
            body: {
                title,
                content,
                mentions: mentions,
            }
        });

        if (data.success) {
            Swal.fire("Post created!");
        } else {
            Swal.fire(data.error);
        }
    } catch (e) {
        Swal.fire("Error creating post: " + e.message);
    }
}

prevBtn.on("click", () => {
    if (skip <= 0) return;
    skip -= 50;
    getPosts();
});

nextBtn.on("click", () => {
    if (NS("#posts-container").get(".nothing-found")[0]) return;
    skip += 50;
    getPosts();
});