import NS from "../nanoscript.min.js";

// Send requests
export async function sendRequest({ body, ...config }) {
    const response = await axios({
        ...config,
        validateStatus: function (status) {
            return (status >= 200 && status < 300) || status === 400;
        },
        data: body
    });

    return response.data;
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
    // Get data
    const quickInfo = await sendRequest({
        url: "/api/v1/get/current-user-quick-info"
    });

    // Attach data
    window.quickInfo = quickInfo;
    const maxPostLength = window?.quickInfo?.maxPostLength;
    initLiveCounter("#create-post-content", "#create-post-content-count", maxPostLength);
    return quickInfo;
}

// Capitalize strings
export function capitalizeFirstLetter(string) {
    if (typeof string !== "string" || !string) return "";
    return string.at(0).toUpperCase() + string.slice(1);
}

// Clean HTML
export function cleanHTML(html) {
    return DOMPurify.sanitize(marked.parse(html), {
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
    return `${window.location.origin + window.location.pathname}?id=${postId}`;
}

// Live coutner
export function initLiveCounter(inputElement, countElement, max) {
    const inputEl = NS(inputElement);
    max = Number.isInteger(max) ? max : 2000;
    inputEl.on("input", function () {
        const length = NS(inputElement).value().length;
        NS(countElement).text(length);
    }).attr("maxLength", max);
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