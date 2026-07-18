NS.getGhostState = () => {
    const currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
    currentSaves.forEach(save => {
        if (document.querySelector(save.selector)) document.querySelector(save.selector)[save.type] = save.value;
    });

    return currentSaves;
}

NS.ghostState = (selector, type = "value") => {
    if (!selector) return console.error("You must provide a selector.");
    const element = document.querySelector(selector);
    type = type === "text" ? "textContent" : type === "html" ? "innerHTML" : "value";

    element.addEventListener("input", function () {
        const currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
        const alreadyExists = currentSaves.find(save => save.selector === selector);

        if (alreadyExists) currentSaves[currentSaves.indexOf(alreadyExists)].value = element[type];
        else currentSaves.push({
            selector: selector,
            type: type,
            value: element[type]
        });

        localStorage.setItem("ns-current-saves", JSON.stringify(currentSaves));
    });
}

NS.clearGhostState = (selector, onEnd) => {
    if (!selector) return console.error("You must provide a selector.");

    let currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
    currentSaves = currentSaves.filter(save => save.selector !== selector);

    localStorage.setItem("ns-current-saves", JSON.stringify(currentSaves));
    if (typeof onEnd === "function") onEnd();
}

NS.updateGhostState = (selector, newValue, onEnd) => {
    if (!selector) return console.error("You must provide a selector.");

    let currentSaves = JSON.parse(localStorage.getItem("ns-current-saves")) || [];
    const itemToUpdate = currentSaves.find(save => save.selector === selector); // Filter to get the element
    if (itemToUpdate) currentSaves[currentSaves.indexOf(itemToUpdate)].value = newValue;

    localStorage.setItem("ns-current-saves", JSON.stringify(currentSaves));
    if (typeof onEnd === "function") onEnd();
    /* I provided the onEnd function so instead of sitting your element
       content in a seperated statment above it, you can use this. Also, if the localstorag
       fails for an error, it won't execute the onEnd function, keeping the sync.
    */
}