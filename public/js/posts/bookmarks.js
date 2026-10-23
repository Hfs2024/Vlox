import { renderPosts } from "./render-posts.js";
import templates from "../core/templates.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    initAccessibility,
    lockEvent,
    config,
    input,
    $
} from "../core/utils.js";

async function renderBookmarks(state = {}) {
    const response = await sendRequest({
        url: `/api/v1/bookmarks/?skip=${state.skip}`,
        method: "POST"
    });

    if (!response.success) return Swal.fire(response.error);

    // Clear container
    $(state.container).empty();

    // No data
    if (!Array.isArray(response.bookmarks) || response.bookmarks.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>You don't have any bookmarks yet.</b>")
            .appendTo(state.container);
        return;
    }

    // Render data
    const fragment = new DocumentFragment();

    response.bookmarks.forEach(bookmark => {
        const safeBookmark = bookmark || {}
        const bookmarkCard = $("<div>").addClass("card");
        const bookmarkHeader = $("<div>").addClass("space-between").appendTo(bookmarkCard);
        const buttons = $("<div>").addClass("center-overflow").appendTo(bookmarkCard);

        // Header
        const title = capitalizeFirstLetter(safeBookmark.title) || "No title";
        $("<h2>").addClass("overflow").text(title).appendTo(bookmarkHeader);

        $("<i>")
            .addClass("fas fa-eye icon-helper")
            .attr({ role: "button", tabindex: "0" })
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/posts/${safeBookmark.for}`
                });

                if (!response.success) return Swal.fire(response.error);
                renderPosts(response.posts);
                Swal.fire("Success", "Post loaded!", "success");
            }))
            .appendTo(bookmarkHeader);

        // Actions
        $("<button>")
            .addClass("btn-danger w-full")
            .text("Delete")
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/bookmarks/${safeBookmark._id}/delete`,
                    method: "DELETE"
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Bookmark deleted!", "success");
            }))
            .appendTo(buttons);

        $("<button>")
            .addClass("w-full")
            .text("Rename")
            .on("click", lockEvent(async function () {
                const result = await input({
                    inputValue: title || "",
                    inputAttributes: {
                        maxLength: config.POST_TITLE_MAX_LENGTH
                    },
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("Please enter title before proceeding!");
                    }
                });

                if (!result.isConfirmed) return;

                // Send request
                const response = await sendRequest({
                    url: `/api/v1/bookmarks/${safeBookmark._id}/rename`,
                    method: "PUT",
                    body: { title: result.value }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Bookmark renamed successfully!", "success");
            }))
            .appendTo(buttons);

        fragment.appendChild(bookmarkCard[0]);
    });

    $(state.container).append(fragment);
    initAccessibility();
}

export default async function showBookmarks() {
    const state = { skip: 0, container: null };

    Swal.fire({
        title: "Your bookmarks: ",
        confirmButtonText: "Close",
        html: templates.USER_BOOKMARKS(),
        didOpen: () => {
            state.container = $("#user-bookmarks-container");

            $("#user-bookmarks-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.BOOKMARKS_LIMIT;
                await renderBookmarks(state);
            }));

            $("#user-bookmarks-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.BOOKMARKS_LIMIT;
                await renderBookmarks(state);
            }));

            renderBookmarks(state);
        }
    });
}