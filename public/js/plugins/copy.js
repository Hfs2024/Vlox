NS.copy = async ({
    text,
    onSuccess,
    onFailure
}) => {
    if (!text) return console.error("Please provide text to copy.");
    if (
        typeof onSuccess !== "function" &&
        typeof onFailure !== "function"
    ) return console.error("onSuccess and onFailure must be a type of funciton.");
     
    await navigator.clipboard.writeText(text)
        .then(() => {
            onSuccess(text);
        })
        .catch(e => {
            onFailure(e);
        })
};