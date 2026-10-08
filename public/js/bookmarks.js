import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import { sendRequest, capitalizeFirstLetter, initAccessibility, lockEvent } from "./utils.js";
import { renderPosts } from "./render-posts.js";

let state = {
    skip: 0,
    container: null,
}

async function renderBookmarks() {
    const response = await sendRequest({
        url: `/api/v1/get/bookmarks/?skip=${state.skip}`,
        method: "POST"
    });

    if (!response.success) return Swal.fire(response.error);

    // Render
    state.container.html("");

    if (!Array.isArray(response.bookmarks) || response.bookmarks.length <= 0) {
        NS.createEl("div", state.container, {
            className: "state-nothing-found"
        }).html("<b>You don't have any bookmarks yet.</b>");
        return;
    }

    response.bookmarks.forEach(bookmark => {
        bookmark = bookmark || {};
        const bookmarkCard = NS.createEl("div", state.container, { className: "card" });
        const bookmarkHeader = NS.createEl("div", bookmarkCard, { className: "space-between" });
        const buttons = NS.createEl("div", bookmarkCard, { className: "center-overflow" });
        const title = capitalizeFirstLetter(bookmark.title) || "No title";

        NS.createEl("h2", bookmarkHeader, { className: "overflow" }).text(title);

        NS.createEl("i", bookmarkHeader, { className: "fas fa-eye icon-helper", role: "button", tabIndex: "0" })
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/get/post/${bookmark.for}`
                });

                if (!response.success) return Swal.fire(response.error);
                renderPosts(response.posts);
                Swal.fire("Success", "Post loaded!", "success");
            }));

        NS.createEl("button", buttons, { className: "btn-danger w-full" })
            .text("Delete")
            .on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: `/api/v1/delete/bookmark/${bookmark._id}`,
                    method: "DELETE"
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Bookmark deleted!", "success");
                renderBookmarks();
            }));

        NS.createEl("button", buttons, { className: "w-full" })
            .text("Rename")
            .on("click", lockEvent(async function () {
                const result = await Swal.fire({
                    title: "Enter new title: ",
                    input: "text",
                    inputPlaceholder: "Enter new title...",
                    inputValue: title || "",
                    showCancelButton: true,
                    preConfirm: result => {
                        if (!result) return Swal.showValidationMessage("Please enter title before proceeding!");
                        if (result.length > config.POST_TITLE_MAX_LENGTH) return Swal.showValidationMessage(`Title must be less than or equal to ${config.POST_TITLE_MAX_LENGTH} chars!`);
                    }
                });

                if (!result.isConfirmed) return;

                // Rename bookmark
                const response = await sendRequest({
                    url: `/api/v1/rename/bookmark/${bookmark._id}`,
                    method: "PUT",
                    body: { title: result.value }
                });

                if (!response.success) return Swal.fire(response.error);
                Swal.fire("Success", "Bookmark renamed successfully!", "success");
                await renderBookmarks();
            }));
    });
}

export default async function showBookmarks() {
    state = { skip: 0, container: null };

    // Container
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
            state.container = NS("#user-bookmarks-container");

            NS("#user-bookmarks-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.BOOKMARKS_LIMIT;
                await renderBookmarks();
            }));

            NS("#user-bookmarks-next-btn").on("click", lockEvent(async function () {
                if (state.container.get(".state-nothing-found")?.elements[0]) return;
                state.skip += config.BOOKMARKS_LIMIT;
                await renderBookmarks();
            }));

            initAccessibility();
            renderBookmarks();
        },
        confirmButtonText: "Close"
    });
}