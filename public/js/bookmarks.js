import { renderPosts } from "./render-posts.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    initAccessibility,
    lockEvent,
    config,
    input,
    $
} from "./utils.js";

let state = {
    skip: 0,
    container: null,
}

async function renderBookmarks() {
    const response = await sendRequest({
        url: `/api/v1/bookmarks/?skip=${state.skip}`,
        method: "POST"
    });

    if (!response.success) return Swal.fire(response.error);

    $(state.container).html("");

    if (!Array.isArray(response.bookmarks) || response.bookmarks.length <= 0) {
        const empty = $("<div>").addClass("state-nothing-found").html("<b>You don't have any bookmarks yet.</b>");
        $(state.container).append(empty);
        return;
    }

    response.bookmarks.forEach(bookmark => {
        const safeBookmark = bookmark || {}
        const bookmarkCard = $("<div>").addClass("card");
        const bookmarkHeader = $("<div>").addClass("space-between").appendTo(bookmarkCard);
        const buttons = $("<div>").addClass("center-overflow").appendTo(bookmarkCard);
        $(state.container).append(bookmarkCard);

        // Header
        const title = capitalizeFirstLetter(safeBookmark.title) || "No title";
        $("<h2>").addClass("overflow").text(title).appendTo(bookmarkHeader);

        $("<i>")
            .addClass("fas fa-eye icon-helper")
            .attr("role", "button")
            .attr("tabindex", "0")
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/posts/${safeBookmark.for}`
                });

                if (!response.success) return Swal.fire(response.error);
                renderPosts(response.posts);
                Swal.fire("Success", "Post loaded!", "success");
            }))
            .appendTo(bookmarkHeader);

        // Action
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
                renderBookmarks();
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
                await renderBookmarks();
            }))
            .appendTo(buttons);
    });
}

export default async function showBookmarks() {
    state = { skip: 0, container: null };

    Swal.fire({
        title: "Your bookmarks: ",
        html: `
<div id="user-bookmarks-container" class="scroll-container"></div>
<div class="center">
  <button id="user-bookmarks-prev-btn"> 
    <i class="fas fa-caret-left"></i>
  </button>
  <button id="user-bookmarks-next-btn">
    <i class="fas fa-caret-right"></i>
  </button>
</div>
        `,
        didOpen: () => {
            state.container = $("#user-bookmarks-container");

            $("#user-bookmarks-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.BOOKMARKS_LIMIT;
                await renderBookmarks();
            }));

            $("#user-bookmarks-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.BOOKMARKS_LIMIT;
                await renderBookmarks();
            }));

            initAccessibility();
            renderBookmarks();
        },
        confirmButtonText: "Close"
    });
}