NS.getGhostState = (saveOnClose = false, onCloseAction) => {
    const currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
    currentSaves.forEach(save => {
        if (document.querySelector(save.selector)) document.querySelector(save.selector)[save.type] = save.value;
    });

    if (saveOnClose) window.addEventListener("beforeunload", function (e) {
        e.preventDefault();
        if (typeof onCloseAction === "function") onCloseAction();
        e.returnValue = "";
    });

    return currentSaves;
}

NS.ghostState = ({
    selector = "",
    type = "value",
    resave = 3000,
    timeout = null,
    onSave
} = {}) => {
    if (!selector) return console.error("You must provide a selector");
    const element = document.querySelector(selector);
    resave = Number.isInteger(resave) ? resave : 3000;
    type = type === "text" ? "textContent" : type === "html" ? "innerHTML" : "value";
    const update = () => {
        const currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
        const alreadyExists = currentSaves.find(save => save.selector === selector);
        if (alreadyExists) currentSaves[currentSaves.indexOf(alreadyExists)].value = element[type];
        else currentSaves.push({
            selector: selector,
            type: type,
            value: element[type]
        });

        localStorage.setItem("ns-current-saves", JSON.stringify(currentSaves));
        if (typeof onSave === "function") onSave();
    }

    element.addEventListener("input", function () {
        if (timeout) clearInterval(timeout);
        timeout = setTimeout(update, resave);
    });
}

NS.clearGhostState = (selector = "", onEnd) => {
    if (!selector) return console.error("You must provide a selector");
    const element = document.querySelector(selector);
    if (!element) return console.error("You must provide a valid selector"); 
    const currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
    const index = currentSaves.findIndex(save => save.selector === selector);
    if (index === -1) return false;

    currentSaves.splice(index, 1);

    localStorage.setItem("ns-current-saves", JSON.stringify(currentSaves));
    if (typeof onEnd === "function") onEnd();
    
    return true;
}

NS.updateGhostState = (selector = "", newValue = "", onEnd) => {
    if (!selector) return console.error("You must provide a selector");
    const element = document.querySelector(selector);
    if (!element) return console.error("You must provide a valid selector");
    const currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
    const index = currentSaves.find(save => save.selector === selector); // Filter to get the element
    if (!index) return false;

    currentSaves[currentSaves.indexOf(index)].value = newValue;
    localStorage.setItem("ns-current-saves", JSON.stringify(currentSaves));
    if (typeof onEnd === "function") onEnd();

    return true;
}