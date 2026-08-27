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
const prevBtn = NS("#prev-btn");
const nextBtn = NS("#next-btn");
let isSearching = false;

// Search
async function search() {
    const value = searchPostsInput.getVal()[0];
    if (!value) return getPosts();

    const searchData = await NS.fetch({
        url: `/api/v1/search/posts/?query=${encodeURI(value)}`,
        method: "GET"
    });

    isSearching = false;
    if (!searchData.success) return Swal.fire(searchData.error);
    renderPosts(Array.isArray(searchData.posts) ? searchData.posts : [searchData.posts]);
}

searchPostsBtn.on("click", function () {
    if (isSearching) return Swal.fire("Still searching...");

    const value = searchPostsInput.getVal()[0];
    if (value.length > 100) return Swal.fire("Query should be less than or equal to 100 chars!");
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

setUpBtnToggle(createSpoilersBtn);

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
    if (!createPostContent.getVal()[0]) return Swal.fire("No content!");

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
    const maxPostContentCharsLength = window?.currentUserQuickInfo?.maxPostContentCharsLength || 2000;

    if (!title || !content) return Swal.fire("Title and content are required!");
    if (title.length > 20 || content.length > maxPostContentCharsLength) return Swal.fire(`Title must be less than 20 chars and content should not exceed ${maxPostContentCharsLength} chars`);
    if (keywords.length > 5) return Swal.fire("Keywords count should be less than 5!");

    await createPost({
        title: title,
        content: content,
        keywords: keywords,
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
async function createPost({ title, content, keywords, spoilers = false } = {}) {
    const data = await NS.fetch({
        url: "/api/v1/posts",
        method: "POST",
        body: {
            title,
            content,
            keywords,
            spoilers: spoilers ? true : false
        }
    });

    if (!data.success) return Swal.fire(data.error);
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