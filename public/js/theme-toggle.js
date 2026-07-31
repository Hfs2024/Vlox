NS.theme({
    key: "theme",
    value: "dark",
    theme: "dark",
    defaultValue: "white"
});

NS("#toggle-theme-btn").on("click", function () {
    NS.themeToggle({
        key: "theme",
        defaultValue: "white",
        firstValue: "white",
        secondValue: "dark",
        theme: "dark"
    });
});