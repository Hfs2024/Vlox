import NS from "../../nanoscript.min.js";

NS.liveCounter = ({
    selector = "",
    max = 100,
    allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Control', 'Alt'],
    counterSelector = "",
    onLimit
}) => {
    if (!Array.isArray(allowedKeys) || !Number.isInteger(max)) return false;
    const element = NS(selector);
    const counterEl = NS(counterSelector);

    element.on("paste", function (e) {
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const newLength = element.value().length + pasted.length;
        const remaining = max - element.value().length;

        if (newLength > max) {
            e.preventDefault();
            element.value(element.value() + pasted.slice(0, remaining));
            const length = element.value().length;
            counterEl.text(`${length}/${max}`);

            if (typeof onLimit === "function") onLimit();
        }
    });

    element.on("keydown", function (e) {
        if (allowedKeys.includes(e.key)) return;
        if (element.value().length >= max) {
            e.preventDefault();
            if (typeof onLimit === "function") onLimit();
        }
    });

    element.on("input", function (e) {
        const length = element.value().length;
        counterEl.text(`${length}/${max}`);
    });

    return element.value().length;
}