const themes = [{
    name: "Default",
    classes: [{
        class: "theme-red",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    },
    {
        class: "theme-green",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    }]
},
{
    name: "Green",
    classes: [{
        class: "theme-green",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "add"
    }, {
        class: "theme-red",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    }]
},
{
    name: "Red",
    classes: [{
        class: "theme-red",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "add"
    }, {
        class: "theme-green",
        elements: ["header", "footer", ".options"],
        postsComponentElements: [".options"],
        action: "remove"
    }]
}];
const changeThemeBtn = NS("#change-theme-btn");
let theme = parseInt(localStorage.getItem("theme")) || 0;
if (themes[theme]) applyTheme(themes[theme]);

changeThemeBtn.on("click", function () {
    theme = parseInt(localStorage.getItem("theme")) || 0;

    Swal.fire({
        title: "Pick a theme: ",
        html: "<div id='themes-container'></div>",
        showCancelButton: true
    }).then(result => {
        if (!result.isConfirmed) return;
        applyTheme(themes[theme]);
        localStorage.setItem("theme", theme); // Critical: Don't save the actual theme object, save it's key index
    });

    const container = NS("#themes-container").addClass("center");

    for (let i = 0; i < themes.length; i++) {
        if (!Array.isArray(themes[i].classes) || !themes[i].name) continue;
        const btn = NS(NS.createEl("button", container, { style: 'width: 100%', className: "theme-btn" })).setText(capitalizeFirstLetter(themes[i].name)).on("click", function () {
            NS(".theme-btn").removeClass("on-bg-color");
            NS(this).addClass("on-bg-color");
            theme = i; // Critical: Save its key, not the object
        });
    }

    NS(NS(".theme-btn")[theme]).addClass("on-bg-color");
});

// Apply theme
function applyTheme(theme) {
    for (let className of theme.classes) {
        if (!Array.isArray(className.elements) || !className.class) continue;
        className.elements.forEach(element => {
            if (className.action === "remove") NS(element).removeClass(className.class);
            else NS(element).addClass(className.class);
        });
    }
}