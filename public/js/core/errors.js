import config from "/config/shared.js";

const errors = {
    ACCOUNT_NOT_FOUND: "We can't find your account right now.",
    ACCOUNT_NOT_FOUND_FOR_USERNAME: "No account was found with that username.",
    BOOKMARK_NOT_FOUND: "Bookmark not found.",
    COMMENT_NOT_FOUND: "Comment not found.",
    COMMENT_REQUIRED: "Please enter a comment.",
    COPY_FAILED: "Failed to copy.",
    DUPLICATE_RESOURCE: "This resource already exists in the system.",
    EMAIL_INVALID: `Email must be valid and no longer than ${config.EMAIL_MAX_LENGTH} characters.`,
    INVALID_CREDENTIALS: "Invalid username or password.",
    INVALID_RECOVERY_CODE: "Invalid recovery code.",
    RECOVERY_CODE_LENGTH: `Recovery code must be exactly ${config.RECOVERY_CODE_LENGTH} characters long.`,
    INVALID_REQUEST: "Please check your input and try again.",
    BIO_MIN_LENGTH: `Bio must be at least ${config.BIO_MIN_LENGTH} characters.`,
    NOT_AUTHENTICATED: "You are not logged in.",
    POST_ACCESS_DENIED: "You do not have access to this post.",
    POST_NOT_FOUND: "Post not found.",
    PROFILE_NOT_FOUND_OR_PRIVATE: "User not found, or their account is private.",
    RATE_LIMITED: "Too many requests. Please try again later.",
    ROUTE_NOT_FOUND: "The requested API route was not found.",
    PASSWORD_LENGTH: `Password must be between ${config.PASSWORD_MIN_LENGTH} and ${config.PASSWORD_MAX_LENGTH} characters.`,
    PASSWORD_MAX_LENGTH: `Password must be no longer than ${config.PASSWORD_MAX_LENGTH} characters.`,
    SESSION_DESTROY_FAILED: "Failed to destroy session.",
    SESSION_INITIALIZATION_FAILED: "Session initialization failed.",
    TITLE_CONTENT_REQUIRED: "Title and content are required.",
    TITLE_REQUIRED: "Please enter a title before proceeding.",
    UNEXPECTED_ERROR: "An unexpected error occurred.",
    USERNAME_LENGTH: `Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} characters.`,
    PASSWORD_UPDATE_FAILED: "Failed to update password."
}

export function getErrorMessage(errorCode) {
    return errors[errorCode] || errors.UNEXPECTED_ERROR;
}

export default errors;
