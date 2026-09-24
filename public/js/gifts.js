import NS from "../nanoscript.min.js";
import { sendRequest, lockEvent } from "./helpers.js";

NS("#view-active-gifts").on("click", lockEvent(async function () {
    const data = await sendRequest({
        url: "/api/v1/get/gifts"
    });

    if (!data.success) return Swal.fire(data.error);
    if (!data.gifts || data.gifts.length <= 0) return Swal.fire("No gifts found.");

    // Show gifts
    Swal.fire({
        title: "Active Free Gifts:",
        html: "<div id='active-links-container' class='scroll-container'></div>",
        confirmButtonText: "Close",
        didOpen: () => {
            data.gifts.forEach(gift => {
                const giftCard = NS.createEl("div", NS("#active-links-container"), { className: "card" });
                NS.createEl("h2", giftCard, { className: "overflow" }).text(gift.name);
                NS.createEl("p", giftCard, {}).html(`<b>Max Uses:</b> ${gift.usesCount} times`);
                NS.createEl("p", giftCard, {}).html(`<b>Used:</b> ${gift.usedCount} times`);
                NS.createEl("button", giftCard, { className: "w-full" }).text("Redeem").on("click", lockEvent(async function () {
                    const redeemData = await sendRequest({
                        url: `/api/v1/redeem/gift-link/${gift._id}`,
                        method: "POST"
                    });

                    if (!redeemData.success) return Swal.fire(redeemData.error);
                    Swal.fire("Success", "Gift redeemed!", "success");
                }));
            });
        }
    });
}));