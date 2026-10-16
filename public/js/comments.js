import {
    sendRequest,
    capitalizeFirstLetter,
    lockEvent,
    config,
    $
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

    $(state.container).html("");

    if (!Array.isArray(response.comments) || response.comments.length <= 0) {
        const empty = $("<div>").addClass("state-nothing-found").html("<b>No comments found!</b>");
        $(state.container).append(empty);
        return;
    }

    response.comments.forEach(comment => {
        comment = comment || {};
        const safeBy = comment.by || {};

        const commentsCard = $("<div>").addClass("card");
        $(state.container).append(commentsCard);

        // Elements
        $("<h3>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(safeBy.username) || "User")
            .appendTo(commentsCard);

        $("<p>")
            .text(comment.content || "No content found")
            .appendTo(commentsCard);

        // Edit
        commentsCard.on("click", function () {
            Swal.fire("Info", "Still working on comment editing feature...", "info");
        });
    });
}

export default async function showComments(id) {
    state = { id, skip: 0, container: null };

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
            state.container = $("#comments-container");

            $("#comments-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.COMMENTS_LIMIT;
                await renderComments();
            }));

            $("#comments-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.COMMENTS_LIMIT;
                await renderComments();
            }));

            renderComments();
        }
    });
}