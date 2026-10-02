import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import { sendRequest, lockEvent, initLiveCounter } from "./helpers.js";
import { getPosts, postsState, renderPosts } from "./render-posts.js";

const createPostBtn = NS("#create-post-btn");
const createPostContent = NS("#create-post-content");
const createPostContentCount = NS("#create-post-content-count");
const createPostKeywords = NS("#create-post-keywords");
const createPostTitle = NS("#create-post-title");
const copyPostContentBtn = NS("#copy-post-content-btn");
const searchPostsInput = NS("#search-posts-input");
const searchPostsBtn = NS("#search-posts-btn");
const postsNavigationContainer = NS("#posts-navigation-container");

// Search
searchPostsInput.attr("maxLength", config.SEARCH_QUERY_LENGTH_MAX);
searchPostsBtn.on("click", lockEvent(async function () {
    const value = searchPostsInput.value();
    if (!value) {
        postsNavigationContainer.css("display", "");
        getPosts(postsState.customPostId);
        return;
    }

    // Find posts
    const searchData = await sendRequest({
        url: `/api/v1/search/posts/?query=${encodeURI(value)}`,
        method: "GET"
    });

    if (!searchData.success) return Swal.fire(searchData.error);

    // Render found posts
    renderPosts(searchData.posts);
    postsNavigationContainer.css("display", "none");
}));

// Copy post content
copyPostContentBtn.on("click", function () {
    if (!createPostContent.value()) return Swal.fire("No content!");

    NS.copy({
        text: createPostContent.value(),
        onSuccess: () => { Swal.fire("Success", "Copied!", "success") },
        onFailure: () => { Swal.fire("Failed", "Failed to copy. Try again", "error") }
    });
});

// Create post
createPostBtn.on("click", lockEvent(async function () {
    const title = createPostTitle.value().trim();
    const content = createPostContent.value().trim();
    const keywords = createPostKeywords.value().trim().split(",").filter(Boolean).map(kw => kw.toLowerCase().trim());

    if (!title || !content) return Swal.fire("Title and content are required!");
    if (title.length > config.POST_TITLE_MAX_LENGTH) return Swal.fire(`Title must be less than ${config.POST_TITLE_MAX_LENGTH} chars!`);
    if (keywords.length > config.POST_KEYWORDS_MAX_LENGTH) return Swal.fire(`Keywords count should not exceed ${config.POST_KEYWORDS_MAX_LENGTH}!`);

    // Create post
    const data = await sendRequest({
        url: "/api/v1/posts",
        method: "POST",
        body: {
            title,
            content,
            keywords
        }
    });

    if (!data.success) return Swal.fire(data.error);

    // Reset
    createPostTitle.value("");
    createPostContent.value("");
    createPostKeywords.value("");
    createPostContentCount.text("0");

    // Success
    Swal.fire({
        title: "Success",
        text: "Post created!",
        icon: "success"
    });
}));

// Navigation
if (!postsState.isCustomPost) {
    NS.createEl("button", postsNavigationContainer, {})
        .html("<i class='fas fa-chevron-left'></i> Prev")
        .on("click", lockEvent(async () => {
            if (postsState.skip <= 0) return;
            postsState.skip -= config.POSTS_LIMIT;
            await getPosts();
        }));

    NS.createEl("button", postsNavigationContainer, {})
        .html("<i class='fas fa-chevron-right'></i> Next")
        .on("click", lockEvent(async () => {
            if (NS("#posts-container").get(".state-nothing-found")?.elements) return;
            postsState.skip += config.POSTS_LIMIT;
            await getPosts();
        }));
}