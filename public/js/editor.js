import { sendRequest, config, $ } from "./utils.js";

export default class Editor {
    constructor({
        initial = {},
        api = {},
        title,
        successMessage
    }) {
        this.initial = initial || {};
        this.api = api || {};
        this.title = title || "Post Editor";
        this.successMessage = successMessage || "Action done successfully!";
    }

    async init() {
        if (!this.api.endpoint || !this.api.method) {
            console.error("Editor Error: Missing 'api.endpoint' or 'api.method' in api configuration.");
            return Swal.fire("Error", "Unable to process the request.", "error");
        }

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

                $("#post-editor-title")
                    .val(this.initial.title || "")
                    .attr("maxLength", config.POST_TITLE_MAX_LENGTH);
                $("#post-editor-keywords")
                    .val(keywords);
                $("#post-editor-content")
                    .val(this.initial.content || "")
                    .attr("maxLength", config.POST_CONTENT_MAX_LENGTH);
            },

            preConfirm: () => {
                const title = $("#post-editor-title").val().trim();
                const content = $("#post-editor-content").val().trim();
                const keywords = $("#post-editor-keywords")
                    .val()
                    .split(",")
                    .filter(Boolean);

                if (!title || !content) return Swal.showValidationMessage("Title and content are required!");
                if (keywords.length > config.POST_KEYWORDS_MAX_LENGTH) return Swal.showValidationMessage(`Keywords count should not exceed ${config.POST_KEYWORDS_MAX_LENGTH}!`);

                return { title, content, keywords };
            }
        });

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
