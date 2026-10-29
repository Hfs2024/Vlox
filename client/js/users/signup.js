import showProfile from "./profile.js";
import errors from "/shared/errors.js";
import templates from "../core/templates.js";
import {
    sendRequest,
    initQuickInfo,
    lockEvent,
    config,
    quickInfo,
    $,
    Alert
} from "../core/utils.js";

const signUpBtn = $("#signup-btn");
const signOutBtn = $("#signout-btn");
const profileBtn = $("#profile-btn");
const loggedInGroup = $("#auth-buttons");
const modalRoutes = {
    "login": showLoginModal,
    "signup": showSignUpModal,
    "password_recovery": showResetPasswordModal
}

$(document).on("click", ".link-swal-auth", function () {
    const target = $(this).data("target");

    if (modalRoutes[target]) modalRoutes[target]();
});

// Quick helpers
function validateAuthField(value, min, max, error) {
    if (!value) return error;
    if (min !== undefined && value.length < min) return error;
    if (max !== undefined && value.length > max) return error;
    return null;
}

async function handleAuthSuccess(message) {
    Alert.success({ text: message });

    await determineAuthButtonsDisplay();
    await initQuickInfo();
}

// Actions
async function showResetPasswordModal() {
    const result = await Swal.fire({
        html: templates.USER_PASSWORD_RESET(),
        stopKeydownPropagation: false,
        showCancelButton: true,
        confirmButtonText: "Submit",
        preConfirm: () => {
            const username = $("#reset-username").val();
            const passwordRaw = $("#reset-password").val();
            const password = passwordRaw ? passwordRaw.trim() : "";
            const recoveryCode = $("#reset-recovery-code").val();

            const usernameErr = validateAuthField(username, config.USERNAME_MIN_LENGTH, config.USERNAME_MAX_LENGTH, errors.USERNAME_LENGTH);
            if (usernameErr) return Swal.showValidationMessage(usernameErr);

            const passwordErr = validateAuthField(password, config.PASSWORD_MIN_LENGTH, config.PASSWORD_MAX_LENGTH, errors.PASSWORD_LENGTH);
            if (passwordErr) return Swal.showValidationMessage(passwordErr);

            if (!recoveryCode || recoveryCode.length !== config.RECOVERY_CODE_LENGTH) {
                return Swal.showValidationMessage(errors.RECOVERY_CODE_LENGTH);
            }

            return { username, password, recoveryCode };
        }
    });

    if (!result.isConfirmed) return;

    const response = await sendRequest({
        url: "/api/v1/users/password",
        method: "POST",
        body: result.value
    });

    if (!response.success) return Alert.error({ text: response.error });
    Alert.success({ text: "Password reset! You can now login" });
}

async function showLoginModal() {
    const result = await Swal.fire({
        html: templates.USER_LOGIN(),
        stopKeydownPropagation: false,
        showCancelButton: true,
        confirmButtonText: "Submit",
        cancelButtonText: "Cancel",

        preConfirm: () => {
            const username = $("#login-username").val();
            const passwordRaw = $("#login-password").val();
            const password = passwordRaw ? passwordRaw.trim() : "";

            const usernameErr = validateAuthField(username, config.USERNAME_MIN_LENGTH, config.USERNAME_MAX_LENGTH, errors.USERNAME_LENGTH);
            if (usernameErr) return Swal.showValidationMessage(usernameErr);

            const passwordErr = validateAuthField(password, undefined, config.PASSWORD_MAX_LENGTH, errors.PASSWORD_MAX_LENGTH);
            if (passwordErr) return Swal.showValidationMessage(passwordErr);

            return { username, password };
        }
    });

    if (!result.isConfirmed) return;

    const response = await sendRequest({
        url: `/api/v1/users/login`,
        method: "POST",
        body: result.value
    });

    if (!response.success) return Alert.error({ text: response.error });

    await handleAuthSuccess("Successfully logged in!");
}

async function showSignUpModal() {
    const result = await Swal.fire({
        html: templates.USER_SIGNUP(),
        stopKeydownPropagation: false,
        showCancelButton: true,
        confirmButtonText: "Submit",
        cancelButtonText: "Cancel",

        didOpen: () => {
            $("#signup-bio").attr("maxlength", config.BIO_MAX_LENGTH);
        },

        preConfirm: () => {
            const username = $("#signup-username").val();
            const passwordRaw = $("#signup-password").val();
            const password = passwordRaw ? passwordRaw.trim() : "";
            const email = $("#signup-email").val();
            const bio = $("#signup-bio").val();

            const usernameErr = validateAuthField(username, config.USERNAME_MIN_LENGTH, config.USERNAME_MAX_LENGTH, errors.USERNAME_LENGTH);
            if (usernameErr) return Swal.showValidationMessage(usernameErr);

            const passwordErr = validateAuthField(password, config.PASSWORD_MIN_LENGTH, config.PASSWORD_MAX_LENGTH, errors.PASSWORD_LENGTH);
            if (passwordErr) return Swal.showValidationMessage(passwordErr);

            if (!email || email.length > config.EMAIL_MAX_LENGTH || !/.+\@.+\..+/.test(email)) {
                return Swal.showValidationMessage(errors.EMAIL_INVALID);
            }

            const bioErr = validateAuthField(bio, config.BIO_MIN_LENGTH, undefined, errors.BIO_MIN_LENGTH);
            if (bioErr) return Swal.showValidationMessage(bioErr);

            return { username, password, email, bio };
        }
    });

    if (!result.isConfirmed) return;

    // Send request
    const response = await sendRequest({
        url: `/api/v1/users/signup`,
        method: "POST",
        body: result.value
    });

    if (!response.success) return Alert.error({ text: response.error });

    // Download recovery codes
    const recoveryCodes = Array.isArray(response.recoveryCodes) ? response.recoveryCodes : [];
    const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
    window.saveAs(blob, "recovery-codes.txt");
    await handleAuthSuccess("Account created successfully!");
}

async function determineAuthButtonsDisplay() {
    const status = await sendRequest({
        url: "/api/v1/me/status"
    });

    const isLoggedIn = !!status.loggedIn;
    signUpBtn.toggle(!isLoggedIn);
    loggedInGroup.toggle(isLoggedIn);
}

signUpBtn.on("click", lockEvent(async function () {
    await showSignUpModal();
}));

signOutBtn.on("click", lockEvent(async function () {
    const response = await sendRequest({
        url: "/api/v1/me/signout",
        method: "DELETE"
    });

    if (!response.success) return Alert.error({ text: response.error });

    await handleAuthSuccess("You have been logged out!");
}));

profileBtn.on("click", lockEvent(async function () {
    await showProfile(quickInfo?._id);
}));

determineAuthButtonsDisplay();