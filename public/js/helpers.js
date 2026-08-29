// Accessibility
function runAccessibility() {
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
    setUpPostsLiveCounter("#create-post-content", "#create-post-content-count", maxPostContentCharsLength);

    return quickInfo;
}

// Capitalize strings
function capitalizeFirstLetter(string) {
    if (typeof string !== "string") return console.error("Invalid string");
    return string.split("")[0].toUpperCase() + string.slice(1) || "";
}

// Taskbar
function setUpTaskbar() {
    NS(".taskbar-button").each((btn, index) => {
        NS(btn).on("click", function () {
            NS(".taskbar-button").removeClass("is-on-bg-color");
            NS(".taskbar-panel").removeClass("taskbar-panel-chosen");
            NS(btn).addClass("is-on-bg-color");
            NS(NS(".taskbar-panel")[index]).addClass("taskbar-panel-chosen");
        });
    });
}

// Change post visibility
function changePostVisibility({
    container,
    buttonText,
    value,
    postId
}) {
    NS(NS.createEl("button", container, {
        id: "change-visibility-user-post-btn",
        className: "w-full"
    })).setText(buttonText).on("click", async function () {
        const visibilityData = await NS.fetch({
            url: `/api/v1/change-visibility/post/${postId}`,
            method: "PUT",
            body: { value: value ? true : false } // Force a boolean
        });

        if (!visibilityData.success) return Swal.fire(visibilityData.error);
        Swal.fire("Success", `Post visibility set as ${value ? "private" : "public"}!`, "success");
    });
}

// Clean HTML
function cleanHTML(html) {
    return DOMPurify.sanitize(marked.parse(html), {
        ALLOWED_TAGS: [
            "pre", "code", "b", "table", "tr", "td", "th", "thead", "tfoot", "tbody",
            "b", "i", "br", "span", "em", "strong", "u", "s", "sub", "sup", "small",
            "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ul", "ol", "li",
            "blockquote", "cite", "q", "img", "video", "audio", "source"
        ]
    });
}

// Post links
function generatePostLink(postId) {
    return `https://vlox.containers.snapdeploy.app/?id=${postId}`;
}

// Preview and spoilers
function setUpPreview({
    btn,
    editContainer,
    previewContainer,
    titleEl,
    contentEl,
    onChange,
} = {}) {
    const toggleDisplay = () => {
        let container = null;

        if (btn?.hasClass("is-on-color")) {
            editContainer?.css({ display: "none" });
            previewContainer?.css({ display: "block" });
            previewContainer?.html(`
          <h2>${titleEl?.getVal()[0] || "No title yet"}</h2>
          <div>${cleanHTML(contentEl?.getVal()[0] || "No content yet")}</div>    
        `);
            container = "edit";
        } else {
            editContainer?.css({ display: "block" });
            previewContainer?.css({ display: "none" });
            container = "preview";
        }

        if (typeof onChange === "function") onChange(container);
    }

    btn?.on("click", function () {
        btn?.toggleClass("is-on-color");
        toggleDisplay();
    });

    toggleDisplay(); // Must run to hide preview container
}

function setUpBtnToggle(btn) {
    btn?.on("click", function () {
        btn.toggleClass("is-on-color");
    });
}

// Setup live coutner
function setUpPostsLiveCounter(element, countElement, maxChars) {
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
runAccessibility();