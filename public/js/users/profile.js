import showBookmarks from "../posts/bookmarks.js";
import templates from "../core/templates.js";
import { renderProfilePosts } from "./profile-feed.js";
import {
    sendRequest,
    capitalizeFirstLetter,
    lockEvent,
    config,
    quickInfo,
    input,
    $,
    Alert
} from "../core/utils.js";

export default async function showProfile(id) {
    // Get data
    const response = await sendRequest({
        url: `/api/v1/users/${id}/profile`
    });

    if (!response.success) return Alert.error({ text: response.error });

    // Save user data temporarily
    const user = response.user || {};
    const state = {
        skip: 0,
        container: null,
        user: {
            username: capitalizeFirstLetter(user.username) || "User",
            bio: user.bio || "",
            private: user.private || false,
            id: user._id,
            isLoggedInUser: user._id === quickInfo?._id
        }
    }

    Swal.fire({
        titleText: `Hello, ${state.user.username}!`,
        html: templates.USER_PROFILE(state),
        confirmButtonText: "Close",
        stopKeydownPropagation: false,
        didOpen: () => {
            state.container = $("#user-posts-container");

            $("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/users/recovery-codes",
                    method: "POST"
                });

                if (!response.success) return Alert.error({ text: response.error });

                // Download recovery codes
                const recoveryCodes = Array.isArray(response.codes) ? response.codes : [];
                const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
                window.saveAs(blob, "recovery-codes.txt");

                Alert.success({ text: "Password Recovery Codes Reseted!" });
            }));

            $("#profile-bio-edit-btn").on("click", lockEvent(async function () {
                const result = await input({
                    inputValue: state.user.bio || "",
                    inputAttributes: {
                        maxLength: config.BIO_MAX_LENGTH
                    },
                    preConfirm: result => {
                        if (result.length < config.BIO_MIN_LENGTH) return Swal.showValidationMessage(`Bio must be at least ${config.BIO_MIN_LENGTH} chars!`);
                    }
                });

                if (!result.isConfirmed) return;

                // Send request
                const response = await sendRequest({
                    url: "/api/v1/me/bio",
                    method: "PUT",
                    body: { bio: result.value }
                });

                if (!response.success) return Alert.error({ text: response.error });
                if (!response.changed) return Alert.info({ text: "No changed were made!" });
                Alert.success({ text: "Bio updated!" });
            }));

            $("#profile-visibility-toggle-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/me/visibility",
                    method: "PUT",
                    body: { value: !state.user.private }
                });

                if (!response.success) return Alert.error({ text: response.error });
                if (!response.changed) return Alert.info({ text: "No changed were made!" });
                Alert.success({ text: `Account is ${state.user.private ? "public" : "private"}` });
            }));

            $("#profile-load-posts-btn").on("click", lockEvent(async function () {
                await renderProfilePosts(state);
            }));

            $("#profile-bookmarks-btn").on("click", lockEvent(async function () {
                await showBookmarks();
            }));

            $("#profile-posts-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.USER_POSTS_LIMIT;
                await renderProfilePosts(state);
            }));

            $("#profile-posts-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.USER_POSTS_LIMIT;
                await renderProfilePosts(state);
            }));
        }
    });
}