import { body, param, query } from "express-validator";
import { validateResult } from "./utiles.js";
import config from "./config/backend.js";

// Helpers
const skipQuery = () => query("skip")
    .exists().withMessage("Skip value is required")
    .isInt({ min: 0 }).withMessage("Skip value must be a non-negative integer");

const usernameBody = () => body("username")
    .exists().withMessage("Username is required")
    .notEmpty().withMessage("Username cannot be empty")
    .isString().withMessage("Username must be a string")
    .isLength({ min: config.USERNAME_MIN_LENGTH, max: config.USERNAME_MAX_LENGTH }).withMessage(`Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} characters`)
    .toLowerCase()
    .trim();

const visibilityValue = () => body("value")
    .exists().withMessage("Visibility value is required")
    .isIn([true, false]).withMessage("Visibility value must be true or false");

const mongoIdParam = (field, label) => param(field)
    .exists().withMessage(`${label} is required`)
    .isMongoId().withMessage(`Invalid ${label} format`);

const postFieldsValidators = () => [
    body("title")
        .notEmpty().withMessage("Post title is required")
        .isString().withMessage("Post title must be a string")
        .trim()
        .isLength({ max: config.POST_TITLE_MAX_LENGTH }).withMessage(`Post title must not exceed ${config.POST_TITLE_MAX_LENGTH} characters`),
    body("content")
        .notEmpty().withMessage("Post content is required")
        .isString().withMessage("Post content must be a string")
        .trim()
        .isLength({ max: config.POST_CONTENT_MAX_LENGTH }).withMessage(`Post content must not exceed ${config.POST_CONTENT_MAX_LENGTH} characters`),
    body("keywords")
        .exists().withMessage("Post keywords are required")
        .isArray({ max: config.POST_KEYWORDS_MAX_LENGTH }).withMessage(`Post keywords must be an array with no more than ${config.POST_KEYWORDS_MAX_LENGTH} items`)
        .customSanitizer(value => value.filter(Boolean).map(kw => kw.toLowerCase().trim()))
]

// Posts
export const createPostsValidator = [
    ...postFieldsValidators(),
    validateResult
]

export const editPostsValidator = [
    mongoIdParam("id", "Post ID"),
    ...postFieldsValidators(),
    validateResult
]

export const getPostsValidator = [
    skipQuery(),
    query("chronological")
        .exists().withMessage("Chronological flag is required")
        .customSanitizer(value => value === "true"),
    validateResult
]

export const searchPostsValidator = [
    query("query")
        .exists().withMessage("Search query is required")
        .notEmpty().withMessage("Search query cannot be empty")
        .isString().withMessage("Search query must be a string")
        .isLength({ max: config.SEARCH_QUERY_LENGTH_MAX }).withMessage(`Search query must not exceed ${config.SEARCH_QUERY_LENGTH_MAX} characters`)
        .customSanitizer(value => value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"))
        .toLowerCase()
        .trim(),
    validateResult
]

export const changePostVisibilityValidator = [
    mongoIdParam("id", "Post ID"),
    visibilityValue(),
    validateResult
]

export const reactOnPostValidator = [
    mongoIdParam("id", "Post ID"),
    param("action")
        .exists().withMessage("Action is required")
        .isIn(["like", "report"]).withMessage("Action must be 'like' or 'report'"),
    validateResult
]

export const defaultPostFindValidator = [
    mongoIdParam("id", "Post ID"),
    validateResult
]

// Security
export const resetPasswordValidator = [
    usernameBody(),
    body("newPassword")
        .exists().withMessage("New password is required")
        .notEmpty().withMessage("New password cannot be empty")
        .isString().withMessage("New password must be a string")
        .isLength({ min: config.PASSWORD_MIN_LENGTH, max: config.PASSWORD_MAX_LENGTH }).withMessage(`New password must be between ${config.PASSWORD_MIN_LENGTH} and ${config.PASSWORD_MAX_LENGTH} characters`)
        .trim(),
    body("recoveryCode")
        .exists().withMessage("Recovery code is required")
        .notEmpty().withMessage("Recovery code cannot be empty")
        .isString().withMessage("Recovery code must be a string")
        .isLength({ min: config.RECOVERY_CODE_LENGTH, max: config.RECOVERY_CODE_LENGTH }).withMessage(`Recovery code must be exactly ${config.RECOVERY_CODE_LENGTH} characters`)
        .trim(),
    validateResult
]

// Gifts
export const redeemGiftLinkValidator = [
    mongoIdParam("id", "Gift link ID"),
    validateResult
]

// Bookmarks
export const getBookmarksValidator = [
    skipQuery(),
    validateResult
]

export const renameBookmarkValidator = [
    mongoIdParam("id", "Bookmark ID"),
    body("title")
        .exists().withMessage("Bookmark title is required")
        .notEmpty().withMessage("Bookmark title cannot be empty")
        .isString().withMessage("Bookmark title must be a string")
        .isLength({ max: config.POST_TITLE_MAX_LENGTH }).withMessage(`Bookmark title must not exceed ${config.POST_TITLE_MAX_LENGTH} characters`)
        .trim(),
    validateResult
]

export const deleteBookmarkValidator = [
    mongoIdParam("id", "Bookmark ID"),
    validateResult
]

// Users
export const loginValidator = [
    usernameBody(),
    body("password")
        .exists().withMessage("Password is required")
        .notEmpty().withMessage("Password cannot be empty")
        .isString().withMessage("Password must be a string")
        .isLength({ max: config.PASSWORD_MAX_LENGTH }).withMessage(`Password must not exceed ${config.PASSWORD_MAX_LENGTH} characters`)
        .trim(),
    validateResult
]

export const signupValidator = [
    usernameBody(),
    body("password")
        .exists().withMessage("Password is required")
        .notEmpty().withMessage("Password cannot be empty")
        .isString().withMessage("Password must be a string")
        .isLength({ min: config.PASSWORD_MIN_LENGTH, max: config.PASSWORD_MAX_LENGTH }).withMessage(`Password must be between ${config.PASSWORD_MIN_LENGTH} and ${config.PASSWORD_MAX_LENGTH} characters`)
        .trim(),
    body("bio")
        .exists().withMessage("Bio is required")
        .notEmpty().withMessage("Bio cannot be empty")
        .isString().withMessage("Bio must be a string")
        .isLength({ min: config.BIO_MIN_LENGTH, max: config.BIO_MAX_LENGTH }).withMessage(`Bio must be between ${config.BIO_MIN_LENGTH} and ${config.BIO_MAX_LENGTH} characters`)
        .trim(),
    body("email")
        .exists().withMessage("Email is required")
        .notEmpty().withMessage("Email cannot be empty")
        .isEmail().withMessage("Email must be a valid email address")
        .isLength({ max: config.EMAIL_MAX_LENGTH }).withMessage(`Email must not exceed ${config.EMAIL_MAX_LENGTH} characters`)
        .normalizeEmail()
        .trim(),
    validateResult
]

export const updateUserValidator = [
    body("newEmoji")
        .optional({ values: "falsy" })
        .isString().withMessage("Emoji must be a string")
        .isIn(config.EMOJIS).withMessage("Emoji is not supported")
        .trim(),
    body("newBio")
        .optional({ values: "falsy" })
        .isString().withMessage("Bio must be a string")
        .isLength({ max: config.BIO_MAX_LENGTH }).withMessage(`Bio must not exceed ${config.BIO_MAX_LENGTH} characters`)
        .trim(),
    validateResult
]

export const changeUserVisibilityValidator = [
    visibilityValue(),
    validateResult
]

export const getUserProfileValidator = [
    mongoIdParam("id", "User ID"),
    validateResult
]

export const getUserPostsValidator = [
    skipQuery(),
    mongoIdParam("id", "User ID"),
    validateResult
]