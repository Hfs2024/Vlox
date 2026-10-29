import { config, $ } from "../core/utils.js"
import templates from "../core/templates.js";
import errors from "/shared/errors.js";

export default class PostEditor {
    #instance;

    constructor(title = "Post editor", initial = {}) {
        this.title = title;
        this.initial = initial;
        this.#instance = null;
    }

    async open() {
        this.#instance = Swal.fire({
            title: this.title,
            html: templates.POST_EDITOR(),
            showCancelButton: true,
            confirmButtonText: "Submit",
            didOpen: () => {
                $(Swal.getPopup()).find("#post-editor-title")
                    .val(this.initial.title || "")
                    .attr("maxLength", config.POST_TITLE_MAX_LENGTH);

                $(Swal.getPopup()).find("#post-editor-content")
                    .val(this.initial.content || "")
                    .attr("maxLength", config.POST_CONTENT_MAX_LENGTH);
            },

            didDestroy: () => {
                this.#instance = null;
            },

            preConfirm: () => {
                const title = $(Swal.getPopup()).find("#post-editor-title").val().trim();
                const content = $(Swal.getPopup()).find("#post-editor-content").val().trim();

                if (!title || !content) return Swal.showValidationMessage(errors.TITLE_CONTENT_REQUIRED);
                return { title, content };
            }
        });

        try {
            return await this.#instance;
        } finally {
            this.#instance = null;
        }
    }

    close() {
        this.#instance?.close();
        this.#instance = null;
    }
}