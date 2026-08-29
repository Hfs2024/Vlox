/**
 * Quick live counterEl for targeted elements
 * @param {string} selector - The selector for the target input or textarea element.
 * @param {number} max - The maximum number of characters allowed in the input field.
 * @param {string[]} allowedKeys - Array of keyboard keys that bypass the character limit restriction.
 * @param {boolean} counterSelector - Toggle to display or hide the current character counterEl element.
 * @param {boolean} remainingSelector - Toggle to display or hide the remainingEl character counterEl element.
 * @param {Function} onLimit - Callback function executed when the character limit is reached or exceeded.
 * @returns {Object} Returns object containing count/remainingEl chars if successfully configured, and false if it fails
 */

NS.liveCounter = ({
    selector = "",
    max = 100,
    allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Control', 'Alt'],
    counterSelector = "",
    remainingSelector = "",
    onLimit
}) => {
    if (!selector || !Number.isInteger(max)) return false;
    const element = NS(selector);
    const counterEl = NS(counterSelector);
    const remainingEl = NS(remainingSelector);

    element.on("paste", function (e) {
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const newLength = element.getVal()[0].length + pasted.length;
        const remaining = max - element.getVal()[0].length;

        if (newLength > max) {
            e.preventDefault();
            element.setVal(element.getVal()[0] + pasted.slice(0, remaining));
            const length = element.getVal()[0].length;
            counterEl.setText(`${length}/${max}`);
            remainingEl.setText(max - length);

            if (typeof onLimit === "function") onLimit();
        }
    });

    element.on("keydown", function (e) {
        if (allowedKeys.includes(e.key)) return;
        if (element.getVal()[0].length >= max) {
            e.preventDefault();
            if (typeof onLimit === "function") onLimit();
        }
    });

    element.on("input", function (e) {
        const length = element.getVal()[0].length;
        counterEl.setText(`${length}/${max}`);
        remainingEl.setText(max - length);
    });

    return {
        count: element.getVal()[0].length,
        remainingEl: max - element.getVal()[0].length
    }
}