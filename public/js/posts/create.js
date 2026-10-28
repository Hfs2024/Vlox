import { lockEvent, config, $, sendRequest, Alert } from "../core/utils.js";
import { getPosts, postsState } from "./main-feed.js";
import PostEditor from "../components/post-editor.js";
import { getErrorMessage } from "../core/errors.js";

const createPostBtn = $("#create-post-btn");
const postsNavigationContainer = $("#posts-navigation-container");

createPostBtn.on("click", lockEvent(async function () {
    const instance = new PostEditor("Create post", {});
    const result = await instance.open();
    if (!result.isConfirmed) return;

    // Send request
    const response = await sendRequest({
        url: "/api/v1/posts",
        method: "POST",
        body: result.value
    });

    if (!response.success) return Alert.error({ text: getErrorMessage(response.error) });
    Alert.success({ text: "Post created!" });
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