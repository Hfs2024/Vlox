NS.liveCounter = ({
    element = "",
    max = 100,
    allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Control', 'Alt'],
    excludeChars = [],
    counterElement = "",
    remainingElement = "",
    showCounter = false,
    showRemaining = false,
    visualFeedback = [],
    runVisualFeedback = false,
    onLimit
}) => {
    if (typeof onLimit !== "function") return console.error("onLimit arg must be a type of function.");
    if (!element || !Number.isInteger(max) || !Array.isArray(allowedKeys) || !Array.isArray(excludeChars) || !Array.isArray(visualFeedback)) return console.error("Please provide all arguments. Make sure max is a number, and excludeChars, visualFeedback and allowedKeys are arrays.");
    const foundElement = document.querySelector(element);
    const runVisualFeedbackCheck = () => {
        const length = foundElement.value.length;

        for (let item of visualFeedback) {
            if (!item.value || !item.class || !Array.isArray(item.addTo)) {
                console.log("One of your visual feedback objects don't match the default syntax.");
                break;
            }

            for (let el of item.addTo) {
                const foundItem = document.querySelector(el);
                if (item.value < length) foundItem.classList.add(item.class);
                else foundItem.classList.remove(item.class);
            }
        }
    }

    let foundCounter = null;
    let foundRemaining = null;
    if (showCounter) foundCounter = document.querySelector(counterElement);
    if (showRemaining) foundRemaining = document.querySelector(remainingElement);

    foundElement.addEventListener('paste', function (e) {
        let pasted = (e.clipboardData || window.clipboardData).getData('text');
        if (excludeChars.some(char => pasted.includes(char))) {
            e.preventDefault();
            pasted = pasted.replaceAll(new RegExp(`[${excludeChars.join('')}]`, 'g'), "");
        }

        const newLength = length + pasted.length;
        const remain = max - length;

        if (newLength > max) {
            e.preventDefault();
            const length = foundElement.value.length;
            foundElement.value += pasted.slice(0, remain);
            if (showCounter && foundCounter) foundCounter.textContent = `${length}/${max}`;
            if (showRemaining && foundRemaining) foundRemaining.textContent = max - length;

            onLimit();
        }
    });

    foundElement.addEventListener('keydown', function (e) {
        if (allowedKeys.includes(e.key)) return;
        if (excludeChars.includes(e.key)) {
            e.preventDefault();
            return;
        }

        const length = foundElement.value.length;
        if (length >= max) {
            e.preventDefault();
            onLimit();
        }
    });

    foundElement.addEventListener("input", function (e) {
        const length = foundElement.value.length;
        if (showCounter && foundCounter) foundCounter.textContent = `${length}/${max}`;
        if (showRemaining && foundRemaining) foundRemaining.textContent = max - length;

        runVisualFeedbackCheck();
    });

    if (runVisualFeedback) runVisualFeedbackCheck();
    return {
        count: foundElement.value.length,
        remaining: max - foundElement.value.length
    }
}