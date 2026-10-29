import config from "/shared/config.js";
import errors from "/shared/errors.js";
import {
    initQuickInfo,
    Alert,
    sendRequest,
    $
} from "../core/utils.js";

const loggedInGroup = $("#auth-buttons");
const signUpBtn = $("#signup-btn");

function validateUsername(username) {
    const { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH } = config;

    if (validator.isEmpty(username)) return errors.VALIDATION.REQUIRED("Username");
    if (!validator.isLength(username, { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })) {
        return errors.VALIDATION.LENGTH_RANGE("Username", USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH);
    }

    return null;
}

function validatePassword(password) {
    const PASSWORD_MAX_LENGTH = config.PASSWORD_MAX_LENGTH;

    if (validator.isEmpty(password)) return errors.VALIDATION.REQUIRED("Password");
    if (!validator.isLength(password, { max: PASSWORD_MAX_LENGTH })) {
        return errors.VALIDATION.MAX_LENGTH("Password", PASSWORD_MAX_LENGTH);
    }

    return null;
}

function validateEmail(email) {
    const EMAIL_MAX_LENGTH = config.EMAIL_MAX_LENGTH;

    if (validator.isEmpty(email)) return errors.VALIDATION.REQUIRED("Email");
    if (!validator.isEmail(email)) return errors.VALIDATION.INVALID_FORMAT("Email");
    if (!validator.isLength(email, { max: EMAIL_MAX_LENGTH })) {
        return errors.VALIDATION.MAX_LENGTH("Email", EMAIL_MAX_LENGTH);
    }

    return null;
}

function validateBio(bio) {
    const { BIO_MIN_LENGTH, BIO_MAX_LENGTH } = config;

    if (validator.isEmpty(bio)) return errors.VALIDATION.REQUIRED("Bio");
    if (!validator.isLength(bio, { min: BIO_MIN_LENGTH, max: BIO_MAX_LENGTH })) {
        return errors.VALIDATION.LENGTH_RANGE("Bio", BIO_MIN_LENGTH, BIO_MAX_LENGTH);
    }

    return null;
}

export function getLoginError(username, password) {
    return validateUsername(username) || validatePassword(password);
}

export function getSignUpError(username, password, email, bio) {
    return validateUsername(username) ||
        validatePassword(password) ||
        validateEmail(email) ||
        validateBio(bio);
}

export async function toggleAuthButtons() {
    const status = await sendRequest({
        url: "/api/v1/me/status"
    });

    const isLoggedIn = !!status.loggedIn;
    signUpBtn.toggle(!isLoggedIn);
    loggedInGroup.toggle(isLoggedIn);
}

export async function handleAuthSuccess(message) {
    Alert.success({ text: message });
    await toggleAuthButtons();
    await initQuickInfo();
}