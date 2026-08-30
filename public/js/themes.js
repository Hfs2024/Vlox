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

const changeThemeBtn = NS("#change-theme-btn");
let currentTheme = localStorage.getItem("theme") || "default";
if (themes[currentTheme]) applyTheme(themes[currentTheme]);

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
            applyTheme(themes[theme]);
            localStorage.setItem("theme", theme);
            Swal.clickConfirm();
        });
    }
});

// Apply theme
function applyTheme(theme) {
    for (let className of theme) {
        if (!Array.isArray(className.elements) || !className.class) continue;
        className.elements.forEach(element => {
            if (className.action === "remove") NS(element).removeClass(className.class);
            else NS(element).addClass(className.class);
        });
    }
}