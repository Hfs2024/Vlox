import { renderPosts } from "./main-feed.js";
import templates from "../core/templates.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    lockEvent,
    config,
    input,
    $,
    Alert
} from "../core/utils.js";

async function getBookmarks(skip = 0) {
    const response = await sendRequest({
        url: `/api/v1/bookmarks/?skip=${skip}`,
        method: "POST"
    });

    return response;
}

async function renderBookmarks(state = {}, preFetchedResponse = null) {
    const response = preFetchedResponse || await getBookmarks(state.skip);
    if (response && !response.success) return Alert.error({ text: response.error });

    // Clear container
    $(state.container).empty();

    // No data
    if (!Array.isArray(response?.bookmarks) || response.bookmarks.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>No bookmarks yet.</b>")
            .appendTo(state.container);
        return;
    }

    // Render data
    const fragment = new DocumentFragment();

    response.bookmarks.forEach(bookmark => {
        const safeBookmark = bookmark || {}
        const bookmarkCard = $("<div>").addClass("card").appendTo(fragment);
        const bookmarkHeader = $("<div>").addClass("space-between").appendTo(bookmarkCard);
        const buttons = $("<div>").addClass("center-overflow").appendTo(bookmarkCard);

        // Header
        $("<h2>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(safeBookmark.title) || "No title")
            .appendTo(bookmarkHeader);

        $("<i>")
            .addClass("fas fa-eye icon-helper")
            .attr({ role: "button", tabindex: "0" })
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/posts/${safeBookmark.for}`
                });

                if (!response.success) return Alert.error({ text: response.error });
                renderPosts(response.posts);
                Alert.success({ text: "Post loaded!" });
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

                if (!response.success) return Alert.error({ text: response.error });
                Alert.success({ text: "Bookmark deleted!" });
            }))
            .appendTo(buttons);

        $("<button>")
            .addClass("w-full")
            .text("Rename")
            .on("click", lockEvent(async function () {
                const result = await input({
                    inputValue: safeBookmark.title || "",
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

                if (!response.success) return Alert.error({ text: response.error });
                Alert.success({ text: "Bookmark renamed successfully!" });
            }))
            .appendTo(buttons);
    });

    $(state.container).append(fragment);
}

export default async function showBookmarks() {
    const state = { skip: 0, container: null };
    const response = await getBookmarks();
    if (!response.success) return Alert.error({ text: response.error });

    Swal.fire({
        title: "Your bookmarks: ",
        confirmButtonText: "Close",
        stopKeydownPropagation: false,
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

            renderBookmarks(state, response);
        }
    });
}