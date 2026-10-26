import { body, param, query } from "express-validator";
import { validateResult } from "./utils.js";
import config from "../config/backend.js";

// Helpers
const isIntQuery = (field, label) => query(field)
    .exists().withMessage(`${label} value is required`)
    .isInt({ min: 0 }).withMessage(`${label} value must be a non-negative integer`);

const isBooleanBody = (field, label) => body(field)
    .exists().withMessage(`${label} value is required`)
    .isIn([true, false, "true", "false"]).withMessage(`${label} value must be true or false`);

const mongoIdParam = (field, label) => param(field)
    .exists().withMessage(`${label} is required`)
    .isMongoId().withMessage(`Invalid ${label} format`);

const userValidator = () => [
    body("username")
        .exists().withMessage("Username is required")
        .isString().withMessage("Username must be a string")
        .trim()
        .notEmpty().withMessage("Username cannot be empty")
        .isLength({ min: config.USERNAME_MIN_LENGTH, max: config.USERNAME_MAX_LENGTH }).withMessage(`Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} characters`)
        .toLowerCase(),

    body("password")
        .exists().withMessage("Password is required")
        .isString().withMessage("Password must be a string")
        .isLength({ max: config.PASSWORD_MAX_LENGTH }).withMessage(`Password must not exceed ${config.PASSWORD_MAX_LENGTH} characters`)
        .trim()
        .notEmpty().withMessage("Password cannot be empty"),
]

const commentBody = () => body("content")
    .exists().withMessage("Content is required")
    .isString().withMessage("Content must be a string")
    .trim()
    .notEmpty().withMessage("Content cannot be empty")
    .isLength({ max: config.COMMENTS_MAX_LENGTH }).withMessage(`Content must not exceed ${config.COMMENTS_MAX_LENGTH} chars`);

const postValidator = () => [
    body("title")
        .isString().withMessage("Post title must be a string")
        .trim()
        .notEmpty().withMessage("Post title is required")
        .isLength({ max: config.POST_TITLE_MAX_LENGTH }).withMessage(`Post title must not exceed ${config.POST_TITLE_MAX_LENGTH} characters`),
    body("content")
        .isString().withMessage("Post content must be a string")
        .trim()
        .notEmpty().withMessage("Post content is required")
        .isLength({ max: config.POST_CONTENT_MAX_LENGTH }).withMessage(`Post content must not exceed ${config.POST_CONTENT_MAX_LENGTH} characters`),
]

// Posts
export const createPostsValidator = [
    ...postValidator(),
    validateResult
]

export const editPostsValidator = [
    mongoIdParam("id", "Post ID"),
    ...postValidator(),
    validateResult
]

export const getPostsValidator = [
    isIntQuery("skip", "Skip"),
    validateResult
]

export const changePostVisibilityValidator = [
    mongoIdParam("id", "Post ID"),
    isBooleanBody("value", "Visibility"),
    validateResult
]

export const defaultPostFindValidator = [
    mongoIdParam("id", "Post ID"),
    validateResult
]

// Comments
export const commentsValidator = [
    mongoIdParam("id", "Post ID"),
    commentBody(),
    validateResult
]

export const editCommentValidator = [
    mongoIdParam("id", "Comment ID"),
    commentBody(),
    validateResult
]

export const getCommentsValidator = [
    isIntQuery("skip", "Skip"),
    mongoIdParam("id", "Post ID"),
    validateResult
]

// Security
export const resetPasswordValidator = [
    ...userValidator(),
    body("recoveryCode")
        .exists().withMessage("Recovery code is required")
        .isString().withMessage("Recovery code must be a string")
        .trim()
        .notEmpty().withMessage("Recovery code cannot be empty")
        .isLength({ min: config.RECOVERY_CODE_LENGTH, max: config.RECOVERY_CODE_LENGTH }).withMessage(`Recovery code must be exactly ${config.RECOVERY_CODE_LENGTH} characters`),
    validateResult
]

// Bookmarks
export const getBookmarksValidator = [
    isIntQuery("skip", "Skip"),
    validateResult
]

export const renameBookmarkValidator = [
    mongoIdParam("id", "Bookmark ID"),
    body("title")
        .exists().withMessage("Bookmark title is required")
        .isString().withMessage("Bookmark title must be a string")
        .trim()
        .notEmpty().withMessage("Bookmark title cannot be empty")
        .isLength({ max: config.POST_TITLE_MAX_LENGTH }).withMessage(`Bookmark title must not exceed ${config.POST_TITLE_MAX_LENGTH} characters`),
    validateResult
]

export const deleteBookmarkValidator = [
    mongoIdParam("id", "Bookmark ID"),
    validateResult
]

// Users
export const loginValidator = [
    ...userValidator(),
    validateResult
]

export const signupValidator = [
    ...userValidator(),
    body("bio")
        .exists().withMessage("Bio is required")
        .isString().withMessage("Bio must be a string")
        .trim()
        .notEmpty().withMessage("Bio cannot be empty")
        .isLength({ min: config.BIO_MIN_LENGTH, max: config.BIO_MAX_LENGTH }).withMessage(`Bio must be between ${config.BIO_MIN_LENGTH} and ${config.BIO_MAX_LENGTH} characters`),
    body("email")
        .exists().withMessage("Email is required")
        .isString().withMessage("Email must be a string")
        .trim()
        .notEmpty().withMessage("Email cannot be empty")
        .isEmail().withMessage("Email must be a valid email address")
        .isLength({ max: config.EMAIL_MAX_LENGTH }).withMessage(`Email must not exceed ${config.EMAIL_MAX_LENGTH} characters`)
        .normalizeEmail(),
    validateResult
]

export const updateUserBioValidator = [
    body("bio")
        .optional({ values: "falsy" })
        .isString().withMessage("Bio must be a string")
        .isLength({ max: config.BIO_MAX_LENGTH }).withMessage(`Bio must not exceed ${config.BIO_MAX_LENGTH} characters`)
        .trim(),
    validateResult
]

export const updateUserVisibilityValidator = [
    isBooleanBody("value", "Visibility"),
    validateResult
]

export const getUserProfileValidator = [
    mongoIdParam("id", "User ID"),
    validateResult
]

export const getUserPostsValidator = [
    isIntQuery("skip", "Skip"),
    mongoIdParam("id", "User ID"),
    validateResult
]