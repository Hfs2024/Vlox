import { config } from "../core/utils.js";
import { getErrorMessage } from "../core/errors.js";

export default class CommentEditor {
    #instance;

    constructor(title = "Comment editor", initial = "") {
        this.title = title;
        this.initial = initial;
        this.#instance = null;
    }

    async open() {
        this.#instance = Swal.fire({
            title: this.title,
            input: "text",
            inputValue: this.initial,
            inputPlaceholder: "Enter value...",
            showCancelButton: true,
            confirmButtonText: "Submit",            
            inputAttributes: {
                maxLength: config.COMMENTS_MAX_LENGTH
            },
            didDestroy: () => {
                this.#instance = null;
            },
            preConfirm: result => {
                if (!result?.trim()) return Swal.showValidationMessage(getErrorMessage("COMMENT_REQUIRED"));
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