import Editor from "../core/editor.js";
import {
    copy,
    renderSafeHtml,
    generatePostLink,
    sendRequest,
    $,
    capitalizeFirstLetter,
    lockEvent
} from "../core/utils.js";

export async function getProfilePosts(userId, skip) {
    const response = await sendRequest({
        url: `/api/v1/users/${userId}/posts/?skip=${skip}`
    });;

    return response;
}

export async function renderProfilePosts(state = {}, preFetchedResponse = null) {
    const response = preFetchedResponse || await getProfilePosts(state.user.id, state.skip);
    if (response && !response.success) return Swal.fire(response.error);

    // Clear container
    $(state.container).empty();

    // No data
    if (!Array.isArray(response?.posts) || response.posts.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>No posts yet.</b>")
            .appendTo(state.container);
        return;
    }

    // Render data
    const fragment = new DocumentFragment();

    response.posts.forEach(post => {
        const safePost = post || {};
        const postCard = $("<div>").addClass("card").appendTo(fragment);
        const postHeader = $("<div>").addClass("space-between").appendTo(postCard);

        // Header
        $("<h2>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(safePost.title) || "Untitled post")
            .appendTo(postHeader);

        $("<i>")
            .addClass("fas fa-link post-icon")
            .attr({ role: "button", tabindex: "0" })
            .on("click", async function () {
                copy(generatePostLink(safePost._id));
            })
            .appendTo(postHeader);

        // Content
        $("<div>")
            .addClass("post-content")
            .html(renderSafeHtml(safePost.content) || "Not content found")
            .appendTo(postCard);

        // Actions
        if (state.user.isLoggedInUser) {
            $("<small>")
                .css("color", "dimgray")
                .html(`(Private): <span style='color: ${safePost.private ? "green" : "red"}'>${safePost.private ? "Yes" : "No"}</span>`)
                .appendTo(postCard);

            const buttonsContainer = $("<div>").addClass("center-overflow");
            postCard.append(buttonsContainer);

            $("<button>")
                .addClass("btn-danger w-full")
                .html("<i class='fas fa-trash'></i>")
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${safePost._id}/delete`,
                        method: "DELETE"
                    });

                    if (!response.success) return Swal.fire(response.error);
                    Swal.fire("Success", "Post deleted!", "success");
                }))
                .appendTo(buttonsContainer);

            $("<button>")
                .addClass("w-full")
                .html("<i class='fas fa-edit'></i>")
                .on("click", lockEvent(async function () {
                    const editorInstance = new Editor({
                        initial: post,
                        successMessage: "Post updated!",
                        title: "Update post: ",
                        api: {
                            endpoint: `/api/v1/posts/${safePost._id}/update`,
                            method: "PUT"
                        },
                    });

                    await editorInstance.init();
                }))
                .appendTo(buttonsContainer);

            $("<button>")
                .addClass("w-full")
                .html(`<i class='fas fa-${safePost.private ? "eye" : "eye-slash"}'></i>`)
                .on("click", lockEvent(async function () {
                    const response = await sendRequest({
                        url: `/api/v1/posts/${safePost._id}/visibility`,
                        method: "PUT",
                        body: { value: !safePost.private }
                    });

                    if (!response.success) return Swal.fire(response.error);
                    Swal.fire("Success", `Post visibility set as ${safePost.private ? "public" : "private"}!`, "success");
                }))
                .appendTo(buttonsContainer);
        }
    });

    $(state.container).append(fragment);
}