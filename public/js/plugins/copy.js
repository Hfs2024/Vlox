NS.copy = async ({
    text,
    onSuccess,
    onFailure
}) => {
    if (!text) return false;
    if (typeof text !== "string") return false;

    try {
        await navigator.clipboard.writeText(text);
        if (typeof onSuccess === "function") onSuccess(text);
        return true;
    } catch (e) {
        if (typeof onFailure === "function") onFailure(e);
        return false;
    }
}