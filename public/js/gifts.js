NS("#view-active-gifts").on("click", lockEvent(async function () {
    const data = await NS.fetch({
        url: "/api/v1/get/gifts"
    });

    if (!data.success) return Swal.fire(data.error);
    if (!data.gifts || data.gifts.length <= 0) return Swal.fire("No gifts found.");
    Swal.fire({
        title: "Active Free Gifts:",
        html: "<div id='active-links-container' class='scroll-container'></div>",
        confirmButtonText: "Close",
    });

    data.gifts.forEach(gift => {
        const giftCard = NS(NS.createEl("div", NS("#active-links-container"), { className: "card" }));
        NS(NS.createEl("h2", giftCard, { className: "overflow" })).setText(gift.name);
        NS(NS.createEl("p", giftCard, {})).html(`<b>Max Uses:</b> ${gift.usesCount} times`);
        NS(NS.createEl("p", giftCard, {})).html(`<b>Used:</b> ${gift.usedCount} times`);
        NS(NS.createEl("button", giftCard, { className: "w-full" })).setText("Redeem").on("click", lockEvent(async function () {
            const redeemData = await NS.fetch({
                url: `/api/v1/redeem/gift-link/${gift._id}`,
                method: "POST"
            });

            if (!redeemData.success) return Swal.fire(redeemData.error);
            Swal.fire("Success", "Gift redeemed!", "success");
        }));
    });
}));