const themes = {
    default: [{
        class: "theme-charcoal",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    }, {
        class: "theme-green",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    }],

    green: [{
        class: "theme-green",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "add"
    }, {
        class: "theme-charcoal",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    }],

    charcoal: [{
        class: "theme-charcoal",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "add"
    }, {
        class: "theme-green",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    }]
}

const changeThemeBtn = NS("#btn-theme");
let currentTheme = localStorage.getItem("theme") || "default";
if (themes[currentTheme]) runThemeEngine(themes[currentTheme], "elements");

changeThemeBtn.on("click", function () {
    Swal.fire({
        title: "Pick a theme: ",
        html: "<div id='themes-container' class='center'></div>",
        confirmButtonText: "Close"
    });

    const container = NS("#themes-container");
    for (let theme in themes) {
        if (!Array.isArray(themes[currentTheme])) continue;
        NS(NS.createEl("button", container, { className: "theme-btn w-full" })).setText(capitalizeFirstLetter(theme)).on("click", function () {
            runThemeEngine(themes[theme], "elements");
            localStorage.setItem("theme", theme);
            Swal.clickConfirm();
        });
    }
});

// Apply theme
function runThemeEngine(theme, category) {
    if (!Array.isArray(theme)) return;

    for (let rule of theme) {
        if (!Array.isArray(rule[category]) || !rule.class) continue;
        rule[category].forEach(element => {
            if (rule.action === "remove") NS(element).removeClass(rule.class);
            else NS(element).addClass(rule.class);
        });
    }
}