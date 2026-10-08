import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import { sendRequest } from "./utils.js";

export default class Editor {
    constructor({
        initial = {},
        api = {},
        title,
        successMessage
    }) {
        this.initial = this.#isObject(initial) ? initial : {}
        this.api = this.#isObject(api) ? api : {};
        this.title = this.#isString(title) ? title : "Post Editor";
        this.successMessage = this.#isString(successMessage) ? successMessage : "Action done successfully!";
    }

    #isObject(obj) {
        return Object.prototype.toString.call(obj) === "[object Object]";
    }

    #isString(str) {
        return typeof str === "string" && str;
    }

    async start() {
        if (!this.#isString(this.api.endpoint) || !this.#isString(this.api.method)) {
            console.error("Editor Error: Missing 'api.endpoint' or 'api.method' configurations.");
            return Swal.fire("Configuration Error", "Unable to process the request due to missing API details.", "error");
        }

        // Container
        const result = await Swal.fire({
            title: this.title,
            html: `
<input id="post-editor-title" type="text" placeholder="Enter post title...">
<input id="post-editor-keywords" type="text" placeholder="Enter post keywords (Comma-separated)...">
<textarea id="post-editor-content" placeholder="Enter post content..."></textarea>
            `,

            showCancelButton: true,
            confirmButtonText: "Submit",

            didOpen: () => {
                const keywords = Array.isArray(this.initial.keywords) ? this.initial.keywords.join(", ") : "";

                NS("#post-editor-title")
                    .value(this.initial.title || "")
                    .attr("maxLength", config.POST_TITLE_MAX_LENGTH);
                NS("#post-editor-keywords")
                    .value(keywords);
                NS("#post-editor-content")
                    .value(this.initial.content || "")
                    .attr("maxLength", config.POST_CONTENT_MAX_LENGTH);
            },

            preConfirm: () => {
                const title = NS("#post-editor-title").value().trim();
                const content = NS("#post-editor-content").value().trim();
                const keywords = NS("#post-editor-keywords")
                    .value()
                    .split(",")
                    .filter(Boolean);

                if (!title || !content) return Swal.showValidationMessage("Title and content are required!");
                if (keywords.length > config.POST_KEYWORDS_MAX_LENGTH) return Swal.showValidationMessage(`Keywords count should not exceed ${config.POST_KEYWORDS_MAX_LENGTH}!`);

                return { title, content, keywords };
            }
        });

        // Send request
        if (!result.isConfirmed) return;

        const response = await sendRequest({
            url: this.api.endpoint,
            method: this.api.method,
            body: result.value
        });

        if (!response.success) return Swal.fire(response.error);
        Swal.fire("Success", this.successMessage, "success");
    }
}
