import NS from "../nanoscript.min.js";
import config from "/config/shared.js";

// Send requests
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

// Accessibility
export function initAccessibility() {
    NS("[role='button']").each(btn => {
        NS(btn).on("keydown", function (e) {
            if (e.key === "Enter" || e.key === ' ') btn.click();
        });
    });
}

// Quick info
export async function getQuickInfo() {
    try {
        // Get data
        const quickInfo = await sendRequest({
            url: "/api/v1/get/user-quick-info"
        });

        // Attach data
        window.quickInfo = quickInfo || {};
    } catch (e) {
        Swal.fire("Error", "Something went wrong!", "error");
    }
}

// Capitalize first letter of a string
export function capitalizeFirstLetter(string) {
    if (typeof string !== "string" || !string) return "";
    const newString = string.at(0).toUpperCase() + string.slice(1);
    return newString.trim();
}

// Clean HTML
export function cleanHTML(html, parse = true) {
    const safeHTML = typeof html === "string" ? html : "";
    const code = parse ? marked.parse(safeHTML) : safeHTML;
    return DOMPurify.sanitize(code, {
        ALLOWED_TAGS: [
            "pre", "code", "b", "i", "br", "span", "em", "strong", "u", "s", "sub", "sup", "small",
            "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ul", "ol", "li",
            "blockquote", "cite", "q", "img", "video", "audio", "source", "a", "#text"
        ],
        KEEP_CONTENT: false
    }).trim();
}

// Post links
export function generatePostLink(postId) {
    const safePostId = postId || "";
    return `${window.location.origin + window.location.pathname}?id=${safePostId}`;
}

// Live coutner
export function initLiveCounter(inputElement, countElement, max) {
    const inputEl = NS(inputElement);
    const safeMax = Number.isInteger(max) ? max : config.POST_CONTENT_MAX_LENGTH;
    inputEl.on("input", function () {
        const length = (inputEl.value() || "").length;
        NS(countElement).text(length);
    }).attr("maxLength", safeMax);
}

// Lock on click
export function lockEvent(fn) {
    if (typeof fn !== "function") return;

    return async function (e) {
        const el = NS(e.currentTarget);
        el.attr("inert", true);

        try {
            await fn(e);
        } catch {
            Swal.fire("Something went wrong!");
        } finally {
            el.removeAttr("inert");
        }
    }
}

// Init
getQuickInfo();
initAccessibility();
initLiveCounter("#create-post-content", "#create-post-content-count", config.POST_CONTENT_MAX_LENGTH);