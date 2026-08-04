// Accessibility
function runAccessibility() {
    NS("[role='button']").each(btn => {
        NS(btn).on("keydown", function (e) {
            if (e.key === "Enter" || e.key === ' ') btn.click();
        });
    });

}

// Get quick info
// Quick info
async function getQuickInfo() {
    const quickInfo = await NS.fetch({
        url: "/api/v1/get/current-user-quick-info"
    });

    window.currentUserQuickInfo = quickInfo;
    const maxPostContentCharsLength = window.currentUserQuickInfo?.maxPostContentCharsLength;
    NS("#create-post-content-count").setText(`${NS("#create-post-content").getVal()[0].length}/${maxPostContentCharsLength || 2000}`);
    setUpLiveCounter("#create-post-content", "#create-post-content-count", window.maxPostContentCharsLength);

    return quickInfo;
}

// Capitalize strings
function capitalizeFirstLtter(string) {
    return string.split("")[0].toUpperCase() + string.slice(1) || "";
}

// Taskbar
function setUpTaskbar() {
    NS(".taskbar-button").each((btn, index) => {
        NS(btn).on("click", function () {
            NS(".taskbar-button").removeClass("taskbar-button-chosen");
            NS(".taskbar-panel").removeClass("taskbar-panel-chosen");
            NS(btn).addClass("taskbar-button-chosen");
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
        style: "width: 100%"
    })).setText(buttonText).on("click", async function () {
        const visibilityData = await NS.fetch({
            url: `/api/v1/change-visibility/post/?id=${postId}`,
            method: "POST",
            body: { value: value ? true : false } // Force a boolean
        });

        if (!visibilityData.success) return Swal.fire(visibilityData.error);
        Swal.fire("Success", `Post visibility set as ${value ? "private" : "public"}!`, "success");
    });
}

// Cleaning HTML
function cleanHTML(html) {
    return DOMPurify.sanitize(marked.parseInline(html));
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

        if (btn?.hasClass("on")) {
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

    btn.on("click", function () {
        btn?.toggleClass("on");
        toggleDisplay();
    });

    toggleDisplay(); // Must run to hide preview container
}

function setUpSpoilers(btn) {
    btn?.on("click", function () {
        btn.toggleClass("on");
    });
}

// Setup live coutner
function setUpLiveCounter(element, countElement, maxChars) {
    NS.liveCounter({
        selector: element,
        counterElement: countElement,
        showCounter: true,
        max: maxChars || 2000,
        runVisualFeedback: true,
        visualFeedback: [
            { value: 499, class: "count-yellow", addTo: [element] },
            { value: 999, class: "count-orange", addTo: [element] },
            { value: 1499, class: "count-red", addTo: [element] },
            { value: 1999, class: "count-darkred", addTo: [element] }
        ]
    });
}

// Init
getQuickInfo();
runAccessibility();