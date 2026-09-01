// Accessibility
function initAccessibility() {
    NS("[role='button']").each(btn => {
        NS(btn).on("keydown", function (e) {
            if (e.key === "Enter" || e.key === ' ') btn.click();
        });
    });
}

// Quick info
async function getQuickInfo() {
    const quickInfo = await NS.fetch({
        url: "/api/v1/get/current-user-quick-info"
    });

    window.currentUserQuickInfo = quickInfo;
    const maxPostContentCharsLength = window?.currentUserQuickInfo?.maxPostContentCharsLength;
    NS("#create-post-content-count").setText(`${NS("#create-post-content").getVal()[0].length}/${maxPostContentCharsLength || 2000}`);
    initLiveCounter("#create-post-content", "#create-post-content-count", maxPostContentCharsLength);

    return quickInfo;
}

// Capitalize strings
function capitalizeFirstLetter(string) {
    if (typeof string !== "string") return console.error("Invalid string");
    return string.split("")[0].toUpperCase() + string.slice(1) || "";
}

// Clean HTML
function cleanHTML(html) {
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
function generatePostLink(postId) {
    return `https://vlox.containers.snapdeploy.app/?id=${postId}`;
}

// Init preview and spoilers
function initPostPreview({
    btn,
    editContainer,
    previewContainer,
    titleEl,
    contentEl,
    onChange,
} = {}) {
    const toggleDisplay = () => {
        if (btn?.hasClass("active-color")) {
            editContainer?.css({ display: "none" });
            previewContainer?.css({ display: "block" });
            previewContainer?.html(`
          <h2>${titleEl?.getVal()[0] || "No title yet"}</h2>
          <div>${cleanHTML(contentEl?.getVal()[0] || "No content yet")}</div>    
        `);
        } else {
            editContainer?.css({ display: "block" });
            previewContainer?.css({ display: "none" });
        }

        if (typeof onChange === "function") onChange(btn?.hasClass("active-color"));
    }

    btn?.on("click", function () {
        btn?.toggleClass("active-color");
        toggleDisplay();
    });

    toggleDisplay(); // Must run to hide preview container
}

function initToggle(btn) {
    btn?.on("click", function () {
        btn?.toggleClass("active-color");
    });
}

// Init live coutner
function initLiveCounter(element, countElement, maxChars) {
    NS.liveCounter({
        selector: element,
        counterSelector: countElement,
        showCounter: true,
        max: maxChars || 2000
    });
}

// Lock on click
function lockEvent(fn) {
    if (typeof fn !== "function") return;

    return async function (event) {
        const el = NS(event.currentTarget);
        el.attr("inert", true);

        try {
            await fn();
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