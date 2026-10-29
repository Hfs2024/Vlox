import { body, param, query } from "express-validator";
import { validateResult } from "./utils.js";
import config from "./config.js";
import errors from "../../shared/errors.js";

// Helpers
const baseTextBody = (field, label) => [
    body(field).exists().withMessage(errors.VALIDATION.REQUIRED(label)),
    body(field).isString().withMessage(errors.VALIDATION.STRING(label)),
    body(field).trim(),
    body(field).notEmpty().withMessage(errors.VALIDATION.EMPTY(label))
]

const queryInt = (field, label) => query(field)
    .exists().withMessage(errors.VALIDATION.REQUIRED(`${label} value`))
    .isInt({ min: 0 }).withMessage(errors.VALIDATION.NON_NEGATIVE_INTEGER(label));

const booleanBody = (field, label) => body(field)
    .exists().withMessage(errors.VALIDATION.REQUIRED(`${label} value`))
    .isBoolean().withMessage(errors.VALIDATION.BOOLEAN(label));

const mongoIdParam = (field, label) => param(field)
    .exists().withMessage(errors.VALIDATION.REQUIRED(label))
    .isMongoId().withMessage(errors.VALIDATION.INVALID_FORMAT(label));

// Domain-specific validators
const userValidator = () => [
    ...baseTextBody("username", "Username"),
    body("username").isLength({ min: config.USERNAME_MIN_LENGTH, max: config.USERNAME_MAX_LENGTH }).withMessage(errors.VALIDATION.LENGTH_RANGE("Username", config.USERNAME_MIN_LENGTH, config.USERNAME_MAX_LENGTH)),
    body("username").toLowerCase(),

    ...baseTextBody("password", "Password"),
    body("password").isLength({ max: config.PASSWORD_MAX_LENGTH }).withMessage(errors.VALIDATION.MAX_LENGTH("Password", config.PASSWORD_MAX_LENGTH))
]

const postValidator = () => [
    ...baseTextBody("title", "Post title"),
    body("title").isLength({ max: config.POST_TITLE_MAX_LENGTH }).withMessage(errors.VALIDATION.MAX_LENGTH("Post title", config.POST_TITLE_MAX_LENGTH)),

    ...baseTextBody("content", "Post content"),
    body("content").isLength({ max: config.POST_CONTENT_MAX_LENGTH }).withMessage(errors.VALIDATION.MAX_LENGTH("Post content", config.POST_CONTENT_MAX_LENGTH))
]

const commentValidator = () => [
    ...baseTextBody("content", "Content"),
    body("content").isLength({ max: config.COMMENTS_MAX_LENGTH }).withMessage(errors.VALIDATION.MAX_LENGTH("Content", config.COMMENTS_MAX_LENGTH))
]

// Posts
export const createPostsValidator = [...postValidator(), validateResult]
export const editPostsValidator = [mongoIdParam("id", "Post ID"), ...postValidator(), validateResult]
export const getPostsValidator = [queryInt("skip", "Skip"), validateResult]
export const changePostVisibilityValidator = [mongoIdParam("id", "Post ID"), booleanBody("value", "Visibility"), validateResult]
export const defaultPostFindValidator = [mongoIdParam("id", "Post ID"), validateResult]

// Comments
export const commentsValidator = [mongoIdParam("id", "Post ID"), ...commentValidator(), validateResult]
export const editCommentValidator = [mongoIdParam("id", "Comment ID"), ...commentValidator(), validateResult]
export const getCommentsValidator = [queryInt("skip", "Skip"), mongoIdParam("id", "Post ID"), validateResult]

// Bookmarks
export const getBookmarksValidator = [queryInt("skip", "Skip"), validateResult]
export const deleteBookmarkValidator = [mongoIdParam("id", "Bookmark ID"), validateResult]
export const renameBookmarkValidator = [
    mongoIdParam("id", "Bookmark ID"),
    ...baseTextBody("title", "Bookmark title"),
    body("title").isLength({ max: config.POST_TITLE_MAX_LENGTH }).withMessage(errors.VALIDATION.MAX_LENGTH("Bookmark title", config.POST_TITLE_MAX_LENGTH)),
    validateResult
]

// Auth
export const loginValidator = [...userValidator(), validateResult]
export const getUserProfileValidator = [mongoIdParam("id", "User ID"), validateResult]
export const getUserPostsValidator = [queryInt("skip", "Skip"), mongoIdParam("id", "User ID"), validateResult]
export const updateUserVisibilityValidator = [booleanBody("value", "Visibility"), validateResult]

export const signupValidator = [
    ...userValidator(),
    ...baseTextBody("bio", "Bio"),
    body("bio").isLength({ min: config.BIO_MIN_LENGTH, max: config.BIO_MAX_LENGTH }).withMessage(errors.VALIDATION.LENGTH_RANGE("Bio", config.BIO_MIN_LENGTH, config.BIO_MAX_LENGTH)),

    ...baseTextBody("email", "Email"),
    body("email").isLength({ max: config.EMAIL_MAX_LENGTH }).withMessage(errors.VALIDATION.MAX_LENGTH("Email", config.EMAIL_MAX_LENGTH)),
    body("email").isEmail().withMessage(errors.VALIDATION.INVALID_FORMAT("Email")),
    body("email").normalizeEmail(),
    validateResult
]

export const updateUserBioValidator = [
    body("bio").optional({ values: "falsy" }),
    body("bio").isString().withMessage(errors.VALIDATION.STRING("Bio")),
    body("bio").isLength({ max: config.BIO_MAX_LENGTH }).withMessage(errors.VALIDATION.MAX_LENGTH("Bio", config.BIO_MAX_LENGTH)),
    body("bio").trim(),
    validateResult
]