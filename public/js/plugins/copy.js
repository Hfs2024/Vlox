/**
 * Copies some text
 * @param {string} text - Provided text to copy 
 * @param {Function} onSuccess - Action triggered when text is successfully copied
 * @param {Function} onFailure - Action triggered on failure
 * @returns {boolean} Returns true if successfully copied, and false if it fails
 */

NS.copy = async ({
    text,
    onSuccess,
    onFailure
}) => {
    if (typeof text === "string") return false;
    if (!text) return false;

    try {
        await navigator.clipboard.writeText(text);
        if (typeof onSuccess === "function") onSuccess(text);
        return true;
    } catch (e) {
        if (typeof onFailure === "function") onFailure(e);
        return false;
    }
}