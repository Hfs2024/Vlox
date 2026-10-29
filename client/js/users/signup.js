import showProfile from "./profile.js";
import templates from "../core/templates.js";
import {
    getLoginError,
    getSignUpError,
    toggleAuthButtons,
    handleAuthSuccess
} from "./signup-helpers.js";
import {
    sendRequest,
    lockEvent,
    config,
    quickInfo,
    $,
    Alert
} from "../core/utils.js";

const signUpBtn = $("#signup-btn");
const signOutBtn = $("#signout-btn");
const profileBtn = $("#profile-btn");

const modalRoutes = {
    "login": showLoginModal,
    "signup": showSignUpModal,
    "password_recovery": () => Alert.info({ text: "Working on an update..." })
}

$(document).on("click", ".link-swal-auth", function () {
    const target = $(this).data("target");
    if (modalRoutes[target]) modalRoutes[target]();
});

async function showLoginModal() {
    const result = await Swal.fire({
        html: templates.USER_LOGIN(),
        stopKeydownPropagation: false,
        showCancelButton: true,
        confirmButtonText: "Submit",
        cancelButtonText: "Cancel",
        preConfirm: () => {
            const $popup = $(Swal.getPopup());
            const username = $popup.find("#login-username").val().trim();
            const password = $popup.find("#login-password").val().trim();

            const error = getLoginError(username, password);
            if (error) return Swal.showValidationMessage(error);

            return { username, password };
        }
    });

    if (!result.isConfirmed) return;

    // Send request
    const response = await sendRequest({
        url: "/api/v1/users/login",
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
            $(Swal.getPopup()).find("#signup-bio").attr("maxlength", config.BIO_MAX_LENGTH);
        },

        preConfirm: () => {
            const $popup = $(Swal.getPopup());
            const username = $popup.find("#signup-username").val().trim();
            const password = $popup.find("#signup-password").val().trim();
            const email = $popup.find("#signup-email").val().trim();
            const bio = $popup.find("#signup-bio").val().trim();

            const error = getSignUpError(username, password, email, bio);
            if (error) return Swal.showValidationMessage(error);

            return { username, password, email, bio };
        }
    });

    if (!result.isConfirmed) return;

    // Send request
    const response = await sendRequest({
        url: "/api/v1/users/signup",
        method: "POST",
        body: result.value
    });

    if (!response.success) return Alert.error({ text: response.error });

    // Download recovery codes
    if (Array.isArray(response.recoveryCodes)) {
        const blob = new Blob([response.recoveryCodes.join("\n")], { type: "text/plain" });
        window.saveAs(blob, "recovery-codes.txt");
    }

    await handleAuthSuccess("Account created successfully!");
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

toggleAuthButtons();