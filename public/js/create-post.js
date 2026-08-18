const createPostBtn = NS("#create-post-btn");
const createPostContent = NS("#create-post-content");
const createPostContentCount = NS("#create-post-content-count");
const createPostKeywords = NS("#create-post-keywords");
const createPostTitle = NS("#create-post-title");
const copyPostContentBtn = NS("#copy-post-content-btn");
const searchPostsInput = NS("#search-posts-input");
const searchPostsBtn = NS("#search-posts-btn");
const createPreviewBtn = NS("#create-preview-mode");
const createSpoilersBtn = NS("#create-spoilers-btn");
const createContainer = NS("#create-container");
const previewContainer = NS("#create-preview-container");
const bookmarksBtn = NS("#post-bookmarks-btn");
const prevBtn = NS("#prev-btn");
const nextBtn = NS("#next-btn");
let isSearching = false;

// Search
async function search() {
    const value = searchPostsInput.getVal()[0];
    if (!value) return getPosts();

    const searchResult = await NS.fetch({
        url: `/api/v1/search/posts/?q=${encodeURI(value)}`,
        method: "GET"
    });

    isSearching = false;
    if (!searchResult.success) return Swal.fire(searchResult.error);
    renderPosts(Array.isArray(searchResult.posts) ? searchResult.posts : [searchResult.posts]);
}

searchPostsBtn.on("click", function () {
    if (isSearching) return Swal.fire("Still searching...");

    const value = searchPostsInput.getVal()[0];
    if (!value) return getPosts();

    isSearching = true;
    search();
});

// Preview create preview mode and spoliers 
setUpPreview({
    btn: createPreviewBtn,
    editContainer: createContainer,
    previewContainer: previewContainer,
    titleEl: createPostTitle,
    contentEl: createPostContent
});

setUpSpoilers(createSpoilersBtn);

// Bookmarks
async function showBookMarks() {
    let bookmarksPosts = await NS.fetch({
        url: "/api/v1/get/bookmarks",
        method: "POST"
    });
    if (!bookmarksPosts.success) return Swal.fire(bookmarksPosts.error);
    let bookmarksSkip = 0;

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

        bookmarksPosts.posts.forEach(bookmark => {
            const bookmarkCard = NS.createEl("div", container, { className: "bookmark" });
            NS(NS.createEl("h2", bookmarkCard, {})).setText(capitalizeFirstLetter(bookmark.title) || `Bookmark ${index + 1}`);
            const buttonGroup = NS.createEl("div", bookmarkCard, { className: "overflow" });
            NS(NS.createEl("button", buttonGroup, { className: "delete-btn" })).setText("Delete bookmark").on("click", async function () {
                const deleteResponse = await NS.fetch({
                    url: `/api/v1/delete/bookmark/${bookmark._id}`,
                    method: "DELETE"
                });

                if (!deleteResponse.success) return Swal.fire(deleteResponse.error);
                Swal.fire("Success", "Bookmark deleted!", "success");
            });

            NS(NS.createEl("button", buttonGroup, { style: "width: 100%" })).setText("Rename bookmark").on("click", function () {
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

            NS(NS.createEl("button", buttonGroup, { style: "width: 100%" })).setText("View bookmark").on("click", async function () {
                const postResponse = await NS.fetch({
                    url: `/api/v1/get/post/${bookmark.for}`
                });

                if (!postResponse.success) return Swal.fire(postResponse.error);
                renderPosts(Array.isArray(postResponse.posts) ? postResponse.posts : [postResponse.posts], skip);
                Swal.clickConfirm();
            });
        });
    }

    // Navigation
    NS("#user-bookmarks-prev-btn").on("click", async function () {
        if (bookmarksSkip <= 0) return;
        bookmarksSkip -= 10;

        bookmarksPosts = await NS.fetch({
            url: `/api/v1/get/bookmarks/posts/?skip=${bookmarksSkip}`,
            method: "POST"
        });

        renderBookmarks();
    });

    NS("#user-bookmarks-next-btn").on("click", async function () {
        if (container.get(".nothing-found")[0]) return;
        bookmarksSkip += 10;

        bookmarksPosts = await NS.fetch({
            url: `/api/v1/get/bookmarks/posts/?skip=${bookmarksSkip}`,
            method: "POST"
        });

        renderBookmarks();
    });

    renderBookmarks();
}

bookmarksBtn.on("click", function () {
    showBookMarks();
});

// Ghost state (Auto save)
function clearGhostState() {
    createPostContentCount.setText(`0/${window.currentUserQuickInfo?.maxPostContentCharsLength || 2000}`);
    NS.clearGhostState("#create-post-title");
    NS.clearGhostState("#create-post-content");
    NS.clearGhostState("#create-post-keywords");
    createPostTitle.setVal("");
    createPostContent.setVal("");
    createPostKeywords.setVal("");
}

NS.getGhostState();
NS.ghostState({ selector: "#create-post-title", resave: 500 });
NS.ghostState({ selector: "#create-post-content", resave: 500 });
NS.ghostState({ selector: "#create-post-keywords", resave: 500 });
NS("#clear-post-content-btn").on("click", function () {
    clearGhostState();
    Swal.fire("Success!", "Draft cleared!", "success");
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
    const keywords = createPostKeywords.getVal()[0]?.trim().split(",");
    const maxPostContentCharsLength = window.currentUserQuickInfo.maxPostContentCharsLength || 2000;

    if (!title || !content) return Swal.fire("Title and content are required!");
    if (title.length > 20 || content.length > maxPostContentCharsLength) return Swal.fire(`Title must be less than 20 chars and content should not exceed ${maxPostContentCharsLength} chars`);
    if (keywords.length > 5) return Swal.fire("Keywords count should be less than 5!");

    await createPost({
        title: title,
        content: content,
        keywords: keywords,
        boost: title.toUpperCase().trim() === "[BOOST]" ? true : false,
        spoilers: createSpoilersBtn.hasClass("on-color")
    });

    // Reset
    clearGhostState();
    getPosts();
    createContainer.css({ display: "block" });
    previewContainer.css({ display: "none" });
    createPreviewBtn.removeClass("on-color");
    createSpoilersBtn.removeClass("on-color");
});

// Create posts function
async function createPost({ title, content, keywords, boost = false, spoilers = false } = {}) {
    const data = await NS.fetch({
        url: "/api/v1/posts",
        method: "POST",
        body: {
            title,
            content,
            keywords,
            boost: boost ? true : false,
            spoilers: spoilers ? true : false
        }
    });

    if (!data.success) Swal.fire(data.error);
    Swal.fire("Post created!");
}

// Navigation
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