// Define themes
const themes = {
    default: [],
    green: [{
        class: "theme-green",
        elements: ["header", "footer", ".options"],
        postsElements: [".options"],
        remove: false
    }],
    charcoal: [{
        class: "theme-charcoal",
        elements: ["header", "footer", ".options"],
        postsElements: [".options"],
        remove: false
    }]
};

// Track current theme
let currentTheme = localStorage.getItem("theme") || "default";
if (!themes[currentTheme]) currentTheme = "default";

// Apply on initial page load
applyTheme(currentTheme, "elements");

// Change theme
NS("#btn-theme").on("click", function () {
    Swal.fire({
        title: "Pick a theme: ",
        html: "<div id='themes-container' class='center'></div>",
        confirmButtonText: "Close"
    });

    for (let themeName in themes) {
        NS(NS.createEl("button", NS("#themes-container"), { className: "w-full" }))
            .setText(themeName)
            .on("click", function () {
                if (themeName === currentTheme) return Swal.close();

                // Apply
                const result = applyTheme(themeName, "elements");
                if (!result) return;

                // Update
                localStorage.setItem("theme", themeName);
                currentTheme = themeName;

                // Close
                Swal.close();
            });
    }
});

// Apply function
function applyTheme(newThemeName, category) {
    if (!Array.isArray(themes[newThemeName]) || !["elements", "postsElements"].includes(category)) return false;
    const isObject = obj => Object.prototype.toString.call(obj) === "[object Object]";

    // Clear
    const oldTheme = Array.isArray(themes[currentTheme]) ? themes[currentTheme] : [];
    if (category === "elements" && oldTheme.length > 0) {
        for (let rule of oldTheme) {
            if (!isObject(rule) || !Array.isArray(rule[category]) || !rule.class) continue;

            rule[category].forEach(element => {
                NS(element).removeClass(rule.class);
            });
        }
    }

    // Add
    const newTheme = themes[newThemeName].filter(rule => rule?.[category]?.length > 0);
    for (let rule of newTheme) {
        if (!isObject(rule) || !Array.isArray(rule[category]) || !rule.class) continue;

        rule[category].forEach(element => {
            const el = NS(element);

            // Apply class
            if (rule.remove) el.removeClass(rule.class);
            el.addClass(rule.class);
        });
    }

    return true;
}
