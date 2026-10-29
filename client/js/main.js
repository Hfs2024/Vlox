import { initQuickInfo, $ } from "./core/utils.js";
import { getPosts, postsState } from "./posts/main-feed.js";
import './users/signup.js';
import './users/profile.js';
import './posts/create.js';

// Init
$(document).on("keydown", "[role='button']", function (e) {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.click();
    }
});

getPosts(postsState.customPostId);
initQuickInfo();