import config from "/config/shared.js";
import NS from "../nanoscript.min.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    lockEvent
} from "./utils.js";

let state = {
    id: null,
    skip: 0,
    container: null
}

async function renderComments() {
    const response = await sendRequest({
        url: `/api/v1/posts/${state.id}/comments/?skip=${state.skip}`
    });

    if (!response.success) return Swal.fire(response.error);

    state.container.html("");

    if (!Array.isArray(response.comments) || response.comments.length <= 0) {
        NS.createEl("div", state.container, { className: "state-nothing-found" })
            .html("<b>No comments found!</b>");
        return;
    }

    response.comments.forEach(comment => {
        comment = comment || {};
        const safeBy = comment.by || {};

        const commentsCard = NS.createEl("div", state.container, { className: "card" });
        NS.createEl("h3", commentsCard, { className: "overflow" }).text(capitalizeFirstLetter(safeBy.username) || "User");
        NS.createEl("p", commentsCard, {}).text(comment.content || "No content found");
    });
}

export default async function showComments(id) {
    state = { id, skip: 0, container: null }

    Swal.fire({
        title: "Comments",
        html: `
<div id="comments-container" class="scroll-container"></div>
<div class="center">
  <button id="comments-prev-btn"><i class="fas fa-caret-left"></i></button>
  <button id="comments-next-btn"><i class="fas fa-caret-right"></i></button>
</div>
        `,
        confirmButtonText: "Close",
        didOpen: () => {
            state.container = NS("#comments-container");

            NS("#comments-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.COMMENTS_LIMIT;
                await renderComments();
            }));

            NS("#comments-next-btn").on("click", lockEvent(async function () {
                if (state.container.get(".state-nothing-found")?.elements[0]) return;
                state.skip += config.COMMENTS_LIMIT;
                await renderComments();
            }));

            renderComments();
        }
    });
}