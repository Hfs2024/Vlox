import NS from "../nanoscript.min.js";
import config from "/config/shared.js";

export function initAccessibility() {
    NS("[role='button']").each(btn => {
        NS(btn).on("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") btn.click();
        });
    });
}

export async function initQuickInfo() {
    try {
        const quickInfo = await sendRequest({
            url: "/api/v1/me/quick-info"
        });

        window.quickInfo = quickInfo || {};
    } catch (e) {
        Swal.fire("Error", "Something went wrong!", "error");
    }
}

export async function copy(str) {
    if (typeof str !== "string" || !str) return "";

    try {
        await navigator.clipboard.writeText(str);
        Swal.fire("Success", "Copied!", "success");
    } catch {
        Swal.fire("Error", "Failed to copy!", "error");
    }
}

export function cleanHTML(html, parse = true) {
    const safeHTML = typeof html === "string" ? html : "";
    const code = parse ? marked.parse(safeHTML) : safeHTML;
    return DOMPurify
        .sanitize(code, {
            ALLOWED_TAGS: config.ALLOWED_TAGS,
            KEEP_CONTENT: false
        })
        .trim();
}

export function generatePostLink(postId) {
    const safePostId = postId || "POST_ID";
    return `${window.location.origin + window.location.pathname}?id=${safePostId}`;
}

export function lockEvent(fn) {
    if (typeof fn !== "function") return;

    return async function (e) {
        const el = NS(e.currentTarget);
        el.attr("inert", true);

        try {
            await fn.call(this, e);
        } catch (e) {
            // For debugging only
            console.error(e);
            Swal.fire("Something went wrong!");
        } finally {
            el.removeAttr("inert");
        }
    }
}

export async function sendRequest({ body, ...requestConfig }) {
    const response = await axios({
        ...requestConfig,
        validateStatus: function (status) {
            return (status >= 200 && status < 300) || [400, 401].some(s => status === s);
        },
        data: body
    });

    return response && response.data ? response.data : {};
}

export function capitalizeFirstLetter(str) {
    if (typeof str !== "string" || !str) return "";
    const newStr = str.at(0).toUpperCase() + str.slice(1);
    return newStr.trim();
}

initQuickInfo();
initAccessibility();