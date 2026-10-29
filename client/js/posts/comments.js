import templates from "../core/templates.js";
import CommentEditor from "../components/comment-editor.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    lockEvent,
    config,
    quickInfo,
    $,
    Alert
} from "../core/utils.js";

async function getComments(state = {}) {
    return await sendRequest({
        url: `/api/v1/posts/${state.id}/comments/?skip=${state.skip}`
    });
}

async function renderComments(state = {}, preFetchedResponse = null) {
    const response = preFetchedResponse || await getComments(state);
    if (response && !response.success) return Alert.error({ text: response.error });

    // Clear container
    $(state.container).empty();

    // No data
    if (!Array.isArray(response?.comments) || response.comments.length <= 0) {
        $("<div>")
            .addClass("state-nothing-found")
            .html("<b>No comments yet.</b>")
            .appendTo(state.container);
        return;
    }

    // Render data
    const fragment = new DocumentFragment();

    response.comments.forEach(comment => {
        const safeComment = comment || {};
        const safeBy = safeComment.by || {};
        const commentsCard = $("<div>").addClass("card").appendTo(fragment);

        // Header
        const commentsHeader = $("<div>").addClass("space-between").appendTo(commentsCard);

        $("<h3>")
            .addClass("overflow")
            .text(capitalizeFirstLetter(safeBy.username) || "User")
            .appendTo(commentsHeader);

        if (safeBy?._id && safeBy._id === quickInfo?._id) {
            $("<i>")
                .addClass("fas fa-pen-to-square icon-helper")
                .attr({ role: "button", tabindex: "0" })
                .on("click", lockEvent(async function () {
                    const instance = new CommentEditor("Edit comment", safeComment.content);
                    const result = await instance.open();
                    if (!result.isConfirmed) return;

                    // Send request
                    const response = await sendRequest({
                        url: `/api/v1/comments/${safeComment._id}/update`,
                        method: "PUT",
                        body: {
                            content: result.value
                        }
                    });

                    if (!response.success) return Alert.error({ text: response.error });
                    if (!response.changed) return Alert.info({ text: "No changed were made!" });

                    Alert.success({ text: "Comment updated!" });
                }))
                .appendTo(commentsHeader);
        }

        /// Content
        $("<p>")
            .text(safeComment.content || "No content found")
            .appendTo(commentsCard);

        // Edited badge
        if (safeComment.editedAt) {
            $("<small>")
                .text("(Edited)")
                .css("color", "gray")
                .appendTo(commentsCard);
        }
    });

    $(state.container).append(fragment);
}

export default async function showComments(id) {
    const state = { id, skip: 0, container: null };
    const response = await getComments(state);
    if (!response.success) return Alert.error({ text: response.error });

    Swal.fire({
        title: "Comments",
        html: templates.POST_COMMENTS(),
        stopKeydownPropagation: false,
        confirmButtonText: "Close",
        didOpen: () => {
            state.container = $("#comments-container");

            $("#comments-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.COMMENTS_LIMIT;
                await renderComments(state);
            }));

            $("#comments-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.COMMENTS_LIMIT;
                await renderComments(state);
            }));

            renderComments(state, response);
        }
    });
}