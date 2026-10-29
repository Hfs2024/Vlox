import $ from "https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.esm.js";
import config from "/shared/config.js";
import errors from "/shared/errors.js";

export async function copy(str) {
    if (!str || typeof str !== "string") return;

    try {
        await navigator.clipboard.writeText(str);
        Alert.success({ text: "Copied!" });
    } catch {
        Alert.error({ text: errors.COPY_FAILED });
    }
}

export function renderSafeHtml(html, parse = true) {
    const rawHtml = html || "";
    const code = parse ? marked.parse(rawHtml) : rawHtml;

    return DOMPurify.sanitize(code, {
        ALLOWED_TAGS: config.ALLOWED_TAGS,
        KEEP_CONTENT: false
    }).trim();
}

export function generatePostLink(postId) {
    return `${window.location.origin}${window.location.pathname}?id=${postId || "POST_ID"}`;
}

export function lockEvent(fn) {
    if (typeof fn !== "function") return;

    return async function (e) {
        const el = $(e.currentTarget);
        el.attr("inert", true);

        try {
            await fn.call(this, e);
        } catch {
            Alert.error({ text: errors.UNEXPECTED_ERROR });
        } finally {
            el.removeAttr("inert");
        }
    }
}

export async function sendRequest({ body, ...requestConfig }) {
    try {
        const response = await axios({
            ...requestConfig,
            validateStatus: status => status >= 200 && status < 500,
            data: body
        });

        return response?.data || {};
    } catch (error) {
        return { error: error.response?.data?.error || errors.UNEXPECTED_ERROR };
    }
}

export function capitalizeFirstLetter(str) {
    if (typeof str !== "string" || !str) return "";
    return (str.charAt(0).toUpperCase() + str.slice(1)).trim();
}

export async function input(config = {}) {
    return Swal.fire({
        title: "Enter value:",
        input: "text",
        inputPlaceholder: "Enter value...",
        showCancelButton: true,
        ...config
    });
}

export let quickInfo = {};

export async function initQuickInfo() {
    try {
        const data = await sendRequest({ url: "/api/v1/me/quick-info" });
        Object.assign(quickInfo, data || {});
    } catch {
        Alert.error({ text: errors.UNEXPECTED_ERROR });
    }
}

const BaseToast = Swal.mixin({
    toast: true,
    position: "bottom-end",
    title: "",
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
    didOpen: toast => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    }
});

export const Alert = {
    success: (config = {}) => BaseToast.fire({ icon: "success", title: "Success", ...config }),
    error: (config = {}) => BaseToast.fire({ icon: "error", title: "Error", ...config }),
    info: (config = {}) => BaseToast.fire({ icon: "info", title: "Info", ...config })
}

export { $, config };