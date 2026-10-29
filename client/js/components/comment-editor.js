import { config } from "../core/utils.js";
import errors from "/shared/errors.js";

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
                if (validator.isEmpty(result)) {
                    return Swal.showValidationMessage(errors.VALIDATION.REQUIRED("Comment"));
                }
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