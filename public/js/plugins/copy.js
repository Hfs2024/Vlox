import NS from "../../nanoscript.min.js";

NS.copy = async ({
    text,
    onSuccess,
    onFailure
}) => {
    if (typeof text !== "string") return false;
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