import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import { lockEvent } from "./utils.js";
import { getPosts, postsState } from "./render-posts.js";
import Editor from "./editor.js";

const createPostBtn = NS("#create-post-btn");
const postsNavigationContainer = NS("#posts-navigation-container");

// Create post
createPostBtn.on("click", lockEvent(async function () {
    const editorInstance = new Editor({
        title: "Create post:",
        successMessage: "Post created!",
        api: {
            endpoint: "/api/v1/posts",
            method: "POST"
        }
    });

    await editorInstance.start();
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