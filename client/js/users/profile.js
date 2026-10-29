import showBookmarks from "../posts/bookmarks.js";
import templates from "../core/templates.js";
import { renderProfilePosts } from "./profile-feed.js";
import errors from "/shared/errors.js";
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

    // Render data
    Swal.fire({
        titleText: `Hello, ${state.user.username}!`,
        html: templates.USER_PROFILE(state),
        confirmButtonText: "Close",
        stopKeydownPropagation: false,
        didOpen: () => {
            const $popup = $(Swal.getPopup());
            state.container = $popup.find("#user-posts-container");

            $popup.find("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
                Alert.info({ text: "Working on an update..." });
            }));

            $popup.find("#profile-bio-edit-btn").on("click", lockEvent(async function () {
                const result = await input({
                    inputValue: state.user.bio || "",
                    inputAttributes: {
                        maxLength: config.BIO_MAX_LENGTH
                    },
                    preConfirm: result => {
                        if (!validator.isLength(result, { min: config.BIO_MIN_LENGTH })) {
                            return Swal.showValidationMessage(errors.VALIDATION.MIN_LENGTH("Bio", config.BIO_MIN_LENGTH));
                        }
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

            $popup.find("#profile-visibility-toggle-btn").on("click", lockEvent(async function () {
                const response = await sendRequest({
                    url: "/api/v1/me/visibility",
                    method: "PUT",
                    body: { value: !state.user.private }
                });

                if (!response.success) return Alert.error({ text: response.error });
                if (!response.changed) return Alert.info({ text: "No changed were made!" });
                Alert.success({ text: `Account is ${state.user.private ? "public" : "private"}` });
            }));

            $popup.find("#profile-load-posts-btn").on("click", lockEvent(async function () {
                await renderProfilePosts(state);
            }));

            $popup.find("#profile-bookmarks-btn").on("click", lockEvent(async function () {
                await showBookmarks();
            }));

            $popup.find("#profile-posts-prev-btn").on("click", lockEvent(async function () {
                if (state.skip <= 0) return;
                state.skip -= config.USER_POSTS_LIMIT;
                await renderProfilePosts(state);
            }));

            $popup.find("#profile-posts-next-btn").on("click", lockEvent(async function () {
                if ($(state.container).find(".state-nothing-found").length) return;
                state.skip += config.USER_POSTS_LIMIT;
                await renderProfilePosts(state);
            }));
        }
    });
}