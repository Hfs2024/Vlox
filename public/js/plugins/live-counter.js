/**
 * Quick live counter for targeted elements
 * @param {string} selector - The selector for the target input or textarea element.
 * @param {number} max - The maximum number of characters allowed in the input field.
 * @param {string[]} allowedKeys - Array of keyboard keys that bypass the character limit restriction.
 * @param {string[]} excludeChars - Array of specific characters to ignore or exclude from the length count.
 * @param {string} counterElement - The selector for the DOM element that displays the current character count.
 * @param {string} remainingElement - The selector for the DOM element that displays the remaining characters left.
 * @param {boolean} showCounter - Toggle to display or hide the current character counter element.
 * @param {boolean} showRemaining - Toggle to display or hide the remaining character counter element.
 * @param {string[]} visualFeedback - Array of CSS classes or effect names to apply when limits or milestones are hit.
 * @param {boolean} runVisualFeedback - Toggle to enable or disable the visual feedback behavior on page load.
 * @param {Function} onLimit - Callback function executed when the character limit is reached or exceeded.
 * @returns {Object} Returns object containing count/remaining chars if successfully configured, and false if it fails
 */

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
    if (!selector || !Number.isInteger(max) || !Array.isArray(allowedKeys) || !Array.isArray(excludeChars) || !Array.isArray(visualFeedback)) {
        console.error("Invalid configuration!");
        return false;
    }

    const element = document.querySelector(selector);
    if (!element) {
        console.error("Invalid selector!");
        return false;
    }

    const runVisualFeedbackCheck = () => {
        const length = element.value.length;

        for (let item of visualFeedback) {
            if (!item.value || !item.class || !Array.isArray(item.elements)) {
                console.log("Invalid configuration!");
                break;
            }

            for (let el of item.elements) {
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

        const newLength = element.value.length + pasted.length;
        const remain = max - element.value.length;
        
        if (newLength > max) {
            e.preventDefault();
            element.value += pasted.slice(0, remain);
            const length = element.value.length;
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