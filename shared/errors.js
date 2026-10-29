const isString = (str) => typeof str === "string" && str.trim();
const getIntegersError = (fallback, ...nums) => nums?.every(Number.isInteger) ? null : fallback;
const formatLabel = (template, label) => 
    (!isString(template) || !isString(label)) 
        ? "Please check your input and try again." 
        : template.replace("{label}", label.trim());

export const errors = {
    INVALID_CREDENTIALS: () => "Invalid username or password.",
    INVALID_RECOVERY_CODE: () => "Invalid recovery code.",
    NOT_AUTHENTICATED: () => "You are not logged in.",
    SESSION_INITIALIZATION_FAILED: () => "Session initialization failed.",
    SESSION_DESTROY_FAILED: () => "Failed to destroy session.",
    ACCOUNT_NOT_FOUND: () => "We can't find your account right now.",
    ACCOUNT_NOT_FOUND_FOR_USERNAME: () => "No account was found with that username.",
    PROFILE_NOT_FOUND_OR_PRIVATE: () => "User not found, or their account is private.",
    PASSWORD_UPDATE_FAILED: () => "Failed to update password.",
    COPY_FAILED: () => "Failed to copy.",
    RATE_LIMITED: () => "Too many requests. Please try again later.",
    UNEXPECTED_ERROR: () => "An unexpected error occurred.",

    // Resources
    DUPLICATE_RESOURCE: () => "This resource already exists in the system.",
    POST_ACCESS_DENIED: () => "You do not have access to this post.",
    NOT_FOUND: (resource) => `${isString(resource) ? resource.trim() : "Requested item"} not found.`,

    // Validation sub-group
    VALIDATION: {
        INVALID_REQUEST: () => "Please check your input and try again.",
        STRING: (label) => formatLabel("{label} must be a string.", label),
        EMPTY: (label) => formatLabel("{label} cannot be empty.", label),
        NON_NEGATIVE_INTEGER: (label) => formatLabel("{label} value must be a non-negative integer.", label),
        BOOLEAN: (label) => formatLabel("{label} value must be true or false.", label),
        INVALID_FORMAT: (label) => formatLabel("Invalid {label} format.", label),
        REQUIRED: (label) => formatLabel("{label} is required.", label),

        MIN_LENGTH: (label, min) => 
            getIntegersError("Please check your input and try again.", min) ?? 
            formatLabel(`{label} must be at least ${min} characters.`, label),

        MAX_LENGTH: (label, max) => 
            getIntegersError("Please check your input and try again.", max) ?? 
            formatLabel(`{label} must not exceed ${max} characters.`, label),

        LENGTH_RANGE: (label, min, max) => 
            getIntegersError("Please check your input and try again.", min, max) ?? 
            formatLabel(`{label} must be between ${min} and ${max} characters.`, label),

        EXACT_LENGTH: (label, length) => 
            getIntegersError("Please check your input and try again.", length) ?? 
            formatLabel(`{label} must be exactly ${length} characters.`, label),

        REQUIRED_FIELDS: (...fields) => {
            const validFields = fields.filter(isString).map(f => f.trim());
            if (validFields.length === 0) return "Required information is missing.";

            const formatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
            return `${formatter.format(validFields)} can't be empty.`;
        }
    }
};

export default errors;