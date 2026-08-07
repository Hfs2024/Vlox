NS.liveCounter = ({
    selector = "",
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
    if (!selector || !Number.isInteger(max) || !Array.isArray(allowedKeys) || !Array.isArray(excludeChars) || !Array.isArray(visualFeedback)) return console.error("Invalid config");
    const element = document.querySelector(selector);
    if (!element) return console.error("You must provide a valid selector");

    const runVisualFeedbackCheck = () => {
        const length = element.value.length;

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

    element.addEventListener('paste', function (e) {
        let pasted = (e.clipboardData || window.clipboardData).getData('text');
        if (excludeChars.some(char => pasted.includes(char))) {
            e.preventDefault();
            pasted = pasted.replaceAll(new RegExp(`[${excludeChars.join('')}]`, 'g'), "");
        }

        const length = element.value.length;
        const newLength = length + pasted.length;
        const remain = max - length;
        
        if (newLength > max) {
            e.preventDefault();
            const length = element.value.length;
            element.value += pasted.slice(0, remain);
            if (showCounter && foundCounter) foundCounter.textContent = `${length}/${max}`;
            if (showRemaining && foundRemaining) foundRemaining.textContent = max - length;

            if (typeof onLimit === "function") onLimit();
        }
    });

    element.addEventListener('keydown', function (e) {
        if (allowedKeys.includes(e.key)) return;
        if (excludeChars.includes(e.key)) {
            e.preventDefault();
            return;
        }

        const length = element.value.length;
        if (length >= max) {
            e.preventDefault();
            if (typeof onLimit === "function") onLimit();
        }
    });

    element.addEventListener("input", function (e) {
        const length = element.value.length;
        if (showCounter && foundCounter) foundCounter.textContent = `${length}/${max}`;
        if (showRemaining && foundRemaining) foundRemaining.textContent = max - length;

        runVisualFeedbackCheck();
    });

    if (runVisualFeedback) runVisualFeedbackCheck();
    return {
        count: element.value.length,
        remaining: max - element.value.length
    }
}