import NS from "../nanoscript.min.js";
import { sendRequest, lockEvent } from "./helpers.js";

NS("#view-active-gifts").on("click", lockEvent(async function () {
    const data = await sendRequest({
        url: "/api/v1/get/gifts"
    });

    if (!data.success) return Swal.fire(data.error);
    const gifts = Array.isArray(data.gifts) ? data.gifts : [];
    if (gifts.length <= 0) return Swal.fire("No gifts found.");

    // Show gifts
    Swal.fire({
        title: "Active Free Gifts:",
        html: "<div id='active-links-container' class='scroll-container'></div>",
        confirmButtonText: "Close",
        didOpen: () => {
            gifts.forEach(gift => {
                const safeGift = gift || {};
                const giftCard = NS.createEl("div", NS("#active-links-container"), { className: "card" });
                NS.createEl("h2", giftCard, { className: "overflow" }).text(safeGift.name || "Gift");
                NS.createEl("p", giftCard, {}).html(`<b>Max Uses:</b> ${Number(safeGift.usesCount ?? 0)} times`);
                NS.createEl("p", giftCard, {}).html(`<b>Used:</b> ${Number(safeGift.usedCount ?? 0)} times`);
                NS.createEl("button", giftCard, { className: "w-full" }).text("Redeem").on("click", lockEvent(async function () {
                    const redeemData = await sendRequest({
                        url: `/api/v1/redeem/gift-link/${safeGift._id}`,
                        method: "POST"
                    });

                    if (!redeemData.success) return Swal.fire(redeemData.error);
                    Swal.fire("Success", "Gift redeemed!", "success");
                }));
            });
        }
    });
}));