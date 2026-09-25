import { sendRequest } from "./helpers.js";

// Input comment
export async function inputComment(title = "Add comment", initialValue = "", onSubmit) {
    const result = await Swal.fire({
        title: title,
        input: 'text',
        inputValue: initialValue,
        inputPlaceholder: 'Type your comment here...',
        showCancelButton: true,
        preConfirm: result => {
            if (!result) return Swal.showValidationMessage("This field cannot be empty!");
            if (result.length > 200) return Swal.showValidationMessage("Comment cannot exceed 200 characters!");

            return result;
        }
    });

    // Action
    if (result.isConfirmed && typeof onSubmit === "function") return onSubmit(result.value);
}

// Reply comment
export function replyComment(postId, parentCommentId) {
    inputComment("Add reply:", "", async (content) => {
        const replyResponse = await sendRequest({
            url: `/api/v1/reply/comment/${parentCommentId}/post/${postId}`,
            method: "POST",
            body: { reply: content }
        });

        if (!replyResponse.success) return Swal.fire(replyResponse.error);
        Swal.fire("Success", "Reply added!", "success");
    });
}