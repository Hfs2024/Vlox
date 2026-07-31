NS.theme = ({
    key = "",
    value = "",
    theme = "",
    defaultValue = "light"
} = {}) => {
    if (!key || !value || !theme) return console.error("You must provide all args.");
    const keyValue = localStorage.getItem(key) || defaultValue;
    if (value === keyValue) document.body.classList.add(theme);

    return keyValue;
}

NS.themeToggle = ({
    key = "",
    firstValue = "",
    secondValue = "",
    theme = "",
    defaultValue = "light"
}) => {
    if (!key || !theme || !firstValue || !secondValue) return console.error("You must provide all args.");
    const keyValue = localStorage.getItem(key) || defaultValue;
    document.body.classList.toggle(theme);

    if (document.body.classList.contains(theme)) {
        localStorage.setItem(key, secondValue);
    } else {
        localStorage.setItem(key, firstValue);
    }
}
