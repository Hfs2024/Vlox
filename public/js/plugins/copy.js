NS.copy = async ({
    text,
    onSuccess,
    onFailure
}) => {
    if (!text) return console.error("Please provide text to copy");

    await navigator.clipboard.writeText(text)
        .then(() => {
           if (typeof onSuccess === "function") onSuccess(text);
        })
        .catch(e => {
            if (typeof onFailure === "function") onFailure(e);
        });
}