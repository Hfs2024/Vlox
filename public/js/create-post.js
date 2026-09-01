const createPostBtn = NS("#create-post-btn");
const createPostContent = NS("#create-post-content");
const createPostContentCount = NS("#create-post-content-count");
const createPostKeywords = NS("#create-post-keywords");
const createPostTitle = NS("#create-post-title");
const copyPostContentBtn = NS("#copy-post-content-btn");
const searchPostsInput = NS("#search-posts-input");
const searchPostsBtn = NS("#btn-search-posts");
const createPreviewBtn = NS("#create-preview-mode");
const createSpoilersBtn = NS("#create-spoilers-btn");
const createContainer = NS("#create-container");
const previewContainer = NS("#create-preview-container");
const prevBtn = NS("#prev-btn");
const nextBtn = NS("#next-btn");

// Search
async function search() {
    const value = searchPostsInput.getVal()[0];
    if (!value) return getPosts();

    const searchData = await NS.fetch({
        url: `/api/v1/search/posts/?query=${encodeURI(value)}`,
        method: "GET"
    });

    if (!searchData.success) return Swal.fire(searchData.error);
    renderPosts(Array.isArray(searchData.posts) ? searchData.posts : [searchData.posts]);
}

searchPostsBtn.on("click", lockEvent(async function () {
    const value = searchPostsInput.getVal()[0];
    if (value.length > 100) return Swal.fire("Query should be less than or equal to 100 chars!");
    if (!value) return getPosts();

    await search();
}));

// Preview mode and spoliers 
setUpPreview({
    btn: createPreviewBtn,
    editContainer: createContainer,
    previewContainer: previewContainer,
    titleEl: createPostTitle,
    contentEl: createPostContent
});

setUpBtnToggle(createSpoilersBtn);

// Copy post content
copyPostContentBtn.on("click", function () {
    if (!createPostContent.getVal()[0]) return Swal.fire("No content!");

    NS.copy({
        text: createPostContent.getVal()[0],
        onSuccess: () => { Swal.fire("Success", "Copied!", "success") },
        onFailure: () => { Swal.fire("Failed", "Failed to copy. Try again", "error") }
    });
});

// Create post
createPostBtn.on("click", lockEvent(async function () {
    const title = createPostTitle.getVal()[0]?.trim();
    const content = createPostContent.getVal()[0]?.trim();
    const keywords = createPostKeywords.getVal()[0]?.trim().split(",").filter(Boolean).map(kw => kw.toLowerCase().trim());
    const maxPostContentCharsLength = window?.currentUserQuickInfo?.maxPostContentCharsLength || 2000;

    if (!title || !content) return Swal.fire("Title and content are required!");
    if (title.length > 20 || content.length > maxPostContentCharsLength) return Swal.fire(`Title must be less than 20 chars and content should not exceed ${maxPostContentCharsLength} chars`);
    if (keywords.length > 5) return Swal.fire("Keywords count should be less than 5!");

    // Create post
    const data = await NS.fetch({
        url: "/api/v1/posts",
        method: "POST",
        body: {
            title,
            content,
            keywords,
            spoilers: createSpoilersBtn.hasClass("active-color")
        }
    });

    if (!data.success) return Swal.fire(data.error);

    // Reset
    createPostTitle.setVal("");
    createPostContent.setVal("");
    createPostKeywords.setVal("");
    createContainer.css({ display: "block" });
    previewContainer.css({ display: "none" });
    createPreviewBtn.removeClass("active-color");
    createSpoilersBtn.removeClass("active-color");
    Swal.fire("Post created!");
    await getPosts();
}));

// Navigation
prevBtn.on("click", lockEvent(async () => {
    if (skip <= 0) return;
    skip -= 50;
    await getPosts();
}));

nextBtn.on("click", lockEvent(async () => {
    if (NS("#posts-container").get(".state-nothing-found")[0]) return;
    skip += 50;
    await getPosts();
}));