import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import { sendRequest, lockEvent } from "./utiles.js";
import { getPosts, postsState, renderPosts } from "./render-posts.js";

const createPostBtn = NS("#create-post-btn");
const createPostContentCount = NS("#create-post-content-count");
const createPostKeywords = NS("#create-post-keywords");
const searchPostsInput = NS("#search-posts-input").attr("maxLength", config.SEARCH_QUERY_LENGTH_MAX);
const searchPostsBtn = NS("#search-posts-btn");
const postsNavigationContainer = NS("#posts-navigation-container");
const createPostContent = NS("#create-post-content")
    .attr("maxLength", config.POST_CONTENT_MAX_LENGTH);
const createPostTitle = NS("#create-post-title")
    .attr("maxLength", config.POST_TITLE_MAX_LENGTH);

// Search
searchPostsBtn.on("click", lockEvent(async function () {
    const setPostsNavDisplay = (value) => {
        if (!postsState.isCustomPost) {
            postsNavigationContainer.css("display", value);
        }
    }

    // Query vlidation
    const value = searchPostsInput.value();
    if (!value) {
        setPostsNavDisplay("");
        getPosts(postsState.customPostId);
        return;
    }

    // Find posts
    const searchData = await sendRequest({
        url: `/api/v1/search/posts/?query=${encodeURIComponent(value)}`,
        method: "GET"
    });

    if (!searchData.success) return Swal.fire(searchData.error);

    // Render found posts
    renderPosts(searchData.posts);
    setPostsNavDisplay("none");
}));

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
        body: { title, content, keywords }
    });

    if (!data.success) return Swal.fire(data.error);

    // Reset
    createPostTitle.value("");
    createPostContent.value("");
    createPostKeywords.value("");
    createPostContentCount.text("0");
    Swal.fire("Success", "Post created!", "success");
}));

// Navigation
if (!postsState.isCustomPost) {
    NS.createEl("button", postsNavigationContainer, {})
        .html("<i class='fas fa-chevron-left'></i> Prev")
        .on("click", lockEvent(async () => {
            if (postsState.skip <= 0) return;
            postsState.skip -= config.POSTS_LIMIT;
            await getPosts(postsState.chronological);
        }));

    NS.createEl("button", postsNavigationContainer, {})
        .html("<i class='fas fa-chevron-right'></i> Next")
        .on("click", lockEvent(async () => {
            if (NS("#posts-container").get(".state-nothing-found")?.elements) return;
            postsState.skip += config.POSTS_LIMIT;
            await getPosts(postsState.chronological);
        }));
}