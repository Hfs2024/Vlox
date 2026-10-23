import { sendRequest, config, $ } from "./utils.js";
import templates from "./templates.js";

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
            html: templates.POST_EDITOR(),
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

        // Send request
        const response = await sendRequest({
            url: this.api.endpoint,
            method: this.api.method,
            body: result.value
        });

        if (!response.success) return Swal.fire(response.error);
        Swal.fire("Success", this.successMessage, "success");
    }
}
