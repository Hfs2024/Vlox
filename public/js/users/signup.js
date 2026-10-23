import showProfile from "./profile.js";
import {
    sendRequest,
    initQuickInfo,
    initAccessibility,
    lockEvent,
    config,
    quickInfo, 
    $
} from "../core/utils.js";
import templates from "../core/templates.js";

const signUpBtn = $("#signup-btn");
const signOutBtn = $("#signout-btn");
const profileBtn = $("#profile-btn");
const loggedInGroup = $("#auth-buttons");

// Quick helpers
function validateAuthField(value, min, max, errorMessage) {
    if (!value) return errorMessage;
    if (min !== undefined && value.length < min) return errorMessage;
    if (max !== undefined && value.length > max) return errorMessage;
    return null;
}

function handleAuthSuccess(message) {
    Swal.fire("Success", message, "success");
    determineAuthButtonsDisplay();
    initQuickInfo();
}

// Actions
async function showResetPasswordModal() {
    const result = await Swal.fire({
        html: templates.USER_PASSWORD_RESET(),
        showCancelButton: true,
        confirmButtonText: "Submit",
        preConfirm: () => {
            const username = $("#username").val();
            const password = $("#password").val();
            const recoveryCode = $("#recovery-code").val();

            const usernameErr = validateAuthField(username, config.USERNAME_MIN_LENGTH, config.USERNAME_MAX_LENGTH, `Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} chars!`);
            if (usernameErr) return Swal.showValidationMessage(usernameErr);

            const passwordErr = validateAuthField(password, config.PASSWORD_MIN_LENGTH, config.PASSWORD_MAX_LENGTH, `Password must be between ${config.PASSWORD_MIN_LENGTH} and ${config.PASSWORD_MAX_LENGTH} chars!`);
            if (passwordErr) return Swal.showValidationMessage(passwordErr);

            if (recoveryCode.length !== config.RECOVERY_CODE_LENGTH) return Swal.showValidationMessage(`Recovery code must be exactly ${config.RECOVERY_CODE_LENGTH} chars long!`);

            return { username, password, recoveryCode };
        }
    });

    if (!result.isConfirmed) return;

    const response = await sendRequest({
        url: "/api/v1/users/password",
        method: "POST",
        body: result.value
    });

    if (!response.success) return Swal.fire(response.error);
    Swal.fire("Success", "Password reset! You can now login", "success");
}

async function showLoginModal() {
    const result = await Swal.fire({
        html: templates.USER_LOGIN(),
        showCancelButton: true,
        confirmButtonText: "Submit",
        cancelButtonText: "Cancel",
        didOpen: () => {
            initAccessibility();
            $(".text-forget-password").on("click", () => showResetPasswordModal());
            $(".link-swal-toggle").on("click", () => showSignUpModal());
        },
        preConfirm: () => {
            const username = $("#username").val();
            const password = $("#password").val();

            const usernameErr = validateAuthField(username, config.USERNAME_MIN_LENGTH, config.USERNAME_MAX_LENGTH, `Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} chars!`);
            if (usernameErr) return Swal.showValidationMessage(usernameErr);

            const passwordErr = validateAuthField(password, undefined, config.PASSWORD_MAX_LENGTH, `Password must be no longer than ${config.PASSWORD_MAX_LENGTH} chars!`);
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

    if (!response.success) return Swal.fire(response.error);

    handleAuthSuccess("Successfully logged in!");
}

async function showSignUpModal() {
    const result = await Swal.fire({
        html: templates.USER_SIGNUP(),
        showCancelButton: true,
        confirmButtonText: "Submit",
        cancelButtonText: "Cancel",
        didOpen: () => {
            $("#bio").attr("maxlength", config.BIO_MAX_LENGTH);
            $(".link-swal-toggle").on("click", () => showLoginModal()); 
            initAccessibility();
        },
        preConfirm: () => {
            const username = $("#username").val();
            const password = $("#password").val();
            const email = $("#email").val();
            const bio = $("#bio").val();

            const usernameErr = validateAuthField(username, config.USERNAME_MIN_LENGTH, config.USERNAME_MAX_LENGTH, `Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} chars!`);
            if (usernameErr) return Swal.showValidationMessage(usernameErr);

            const passwordErr = validateAuthField(password, config.PASSWORD_MIN_LENGTH, config.PASSWORD_MAX_LENGTH, `Password must be between ${config.PASSWORD_MIN_LENGTH} and ${config.PASSWORD_MAX_LENGTH} chars!`);
            if (passwordErr) return Swal.showValidationMessage(passwordErr);

            if (email.length > config.EMAIL_MAX_LENGTH || !/.+\@.+\..+/.test(email)) return Swal.showValidationMessage(`Email must be valid and no longer than ${config.EMAIL_MAX_LENGTH} chars!`);

            const bioErr = validateAuthField(bio, config.BIO_MIN_LENGTH, undefined, `Bio must be at least ${config.BIO_MIN_LENGTH} chars!`);
            if (bioErr) return Swal.showValidationMessage(bioErr);

            return { username, password, email, bio };
        }
    });

    if (!result.isConfirmed) return;

    const response = await sendRequest({
        url: `/api/v1/users/signup`,
        method: "POST",
        body: result.value
    });

    if (!response.success) return Swal.fire(response.error);

    const recoveryCodes = Array.isArray(response.recoveryCodes) ? response.recoveryCodes : [];
    const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    $("<a>")
        .attr("href", url)
        .attr("download", "recovery-codes.txt")
        .appendTo(document.body)
        .trigger("click")
        .remove();
    URL.revokeObjectURL(url);

    handleAuthSuccess("Account created successfully!");
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

    if (!response.success) return Swal.fire(response.error);

    handleAuthSuccess("You have been logged out!");
}));

profileBtn.on("click", lockEvent(async function () {
    await showProfile(quickInfo?._id);
}));

determineAuthButtonsDisplay();