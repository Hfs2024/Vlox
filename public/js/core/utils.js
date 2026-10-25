import $ from "https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.esm.js";
import config from "/config/shared.js";

export async function copy(str) {
    if (!str || typeof str !== "string") return;

    try {
        await navigator.clipboard.writeText(str);
        Swal.fire("Success", "Copied!", "success");
    } catch {
        Swal.fire("Error", "Failed to copy!", "error");
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
            Swal.fire("Error", "Something went wrong!", "error");
        } finally {
            el.removeAttr("inert");
        }
    }
}

export async function sendRequest({ body, ...requestConfig }) {
    try {
        const response = await axios({
            ...requestConfig,
            validateStatus: (status) => (status >= 200 && status < 300) || [400, 401].includes(status),
            data: body
        });

        return response?.data || {};
    } catch {
        return { error: "An unexpected error occurred" }
    }
}

export function capitalizeFirstLetter(str) {
    if (typeof str !== "string" || !str) return "";
    return (str.charAt(0).toUpperCase() + str.slice(1)).trim();
}

export async function input(inputConfig = {}) {
    return Swal.fire({
        title: "Enter value:",
        input: "text",
        inputPlaceholder: "Enter value...",
        showCancelButton: true,
        ...inputConfig
    });
}

export let quickInfo = {};

export async function initQuickInfo() {
    try {
        const data = await sendRequest({ url: "/api/v1/me/quick-info" });
        Object.assign(quickInfo, data || {});
    } catch {
        Swal.fire("Error", "Something went wrong!", "error");
    }
}

export { $, config };