import { lockEvent, config, $ } from "../core/utils.js";
import { getPosts, postsState } from "./main-feed.js";
import Editor from "../core/editor.js";

const createPostBtn = $("#create-post-btn");
const postsNavigationContainer = $("#posts-navigation-container");

createPostBtn.on("click", lockEvent(async function () {
    const editorInstance = new Editor({
        title: "Create post:",
        successMessage: "Post created!",
        api: {
            endpoint: "/api/v1/posts",
            method: "POST"
        }
    });

    await editorInstance.init();
}));

if (!postsState.customPostId) {
    $("<button>")
        .html("<i class='fas fa-chevron-left'></i> Prev")
        .on("click", lockEvent(async () => {
            if (postsState.skip <= 0) return;
            postsState.skip -= config.POSTS_LIMIT;
            await getPosts();
        }))
        .appendTo(postsNavigationContainer);

    $("<button>")
        .html("<i class='fas fa-chevron-right'></i> Next")
        .on("click", lockEvent(async () => {
            if ($("#posts-container").find(".state-nothing-found").length) return;
            postsState.skip += config.POSTS_LIMIT;
            await getPosts();
        }))
        .appendTo(postsNavigationContainer);
}