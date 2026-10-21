import { sendRequest, config, $ } from "./utils.js";

export default class Editor {
    constructor({
        initial = {},
        api = {},
        title = "Post Editor",
        successMessage = "Action done successfully!"
    }) {
        this.initial = initial;
        this.api = api;
        this.title = title;
        this.successMessage = successMessage;
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
<textarea id="post-editor-content" placeholder="Enter post content..."></textarea>
            `,

            showCancelButton: true,
            confirmButtonText: "Submit",

            didOpen: () => {
               $("#post-editor-title")
                    .val(this.initial.title || "")
                    .attr("maxLength", config.POST_TITLE_MAX_LENGTH);

                $("#post-editor-content")
                    .val(this.initial.content || "")
                    .attr("maxLength", config.POST_CONTENT_MAX_LENGTH);
            },

            preConfirm: () => {
                const title = $("#post-editor-title").val().trim();
                const content = $("#post-editor-content").val().trim();

                if (!title || !content) return Swal.showValidationMessage("Title and content are required!");
                return { title, content };
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
