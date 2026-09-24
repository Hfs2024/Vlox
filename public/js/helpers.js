import NS from "../nanoscript.min.js";
import "./plugins/live-counter.js";

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
    window.currentUserQuickInfo = quickInfo;
    const maxPostContentCharsLength = window?.currentUserQuickInfo?.maxPostContentCharsLength;
    NS("#create-post-content-count").text(`${NS("#create-post-content").value().length}/${maxPostContentCharsLength || 2000}`);
    initLiveCounter("#create-post-content", "#create-post-content-count", maxPostContentCharsLength);

    return quickInfo;
}

// Capitalize strings
export function capitalizeFirstLetter(string) {
    if (typeof string !== "string") return console.error("Invalid string");
    return string.split("")[0].toUpperCase() + string.slice(1) || "";
}

// Clean HTML
export function cleanHTML(html) {
    return DOMPurify.sanitize(marked.parse(html), {
        ALLOWED_TAGS: [
            "pre", "code", "b", "table", "tr", "td", "th", "thead", "tfoot", "tbody",
            "b", "i", "br", "span", "em", "strong", "u", "s", "sub", "sup", "small",
            "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ul", "ol", "li",
            "blockquote", "cite", "q", "img", "video", "audio", "source", "a"
        ]
    });
}

// Post links
export function generatePostLink(postId) {
    return `${window.location.origin + window.location.pathname}?id=${postId}`;
}

// Init live coutner
export function initLiveCounter(element, countElement, maxChars = 2000) {
    NS.liveCounter({
        selector: element,
        counterSelector: countElement,
        showCounter: true,
        max: maxChars
    });
}

// Lock on click
export function lockEvent(fn) {
    if (typeof fn !== "function") return;

    return async function (e) {
        const el = NS(e.currentTarget);
        el.attr("inert", true);

        try {
            await fn(e);
        } catch (e) {
            console.error(e);
            Swal.fire("Something went wrong!");
        } finally {
            el.removeAttr("inert");
        }
    }
}

// Init
getQuickInfo();
initAccessibility();