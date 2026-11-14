import { GAME } from "./Game_Interface";

// escape text that goes inside HTML so odd characters in a game name can't break the email
const esc = (s: unknown) =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const inr = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function createHTMLTemplate(all_games: GAME[]) {
    const gamesHTML = all_games
        .map((game) => {
            // original_price and prices[].price are in paise; price_required is in rupees
            const originalPrice = Number(game.original_price) / 100;

            const lastPrice = game.prices?.[game.prices.length - 1]?.price;
            const hasCurrent = lastPrice !== undefined && lastPrice !== null;
            const currentPrice = hasCurrent ? Number(lastPrice) / 100 : originalPrice;

            const targetPrice = Number(game.price_required);

            const discount =
                originalPrice > 0 && currentPrice < originalPrice
                    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
                    : 0;

            const isTargetReached = targetPrice > 0 && currentPrice <= targetPrice;

            // built from app_id so it never goes stale when Steam changes the artwork
            const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${esc(game.app_id)}/header.jpg`;

            return `
<div style="background-color: ${isTargetReached ? "#17291f" : "#1c1c1c"}; border-radius: 10px; overflow: hidden; margin-bottom: 16px; border: 1px solid ${isTargetReached ? "#286342" : "#333333"};">
    <img
        src="${imageUrl}"
        alt="${esc(game.name)}"
        width="600"
        style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;"
    />

    <div style="padding: 14px;">
        <h2 style="color: #ffffff; font-size: 16px; line-height: 1.3; margin: 0 0 10px;">
            ${esc(game.name)}
        </h2>

        <div style="margin-bottom: 10px;">
            ${
                discount > 0
                    ? `<span style="background-color: #4c6b22; color: #beee11; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">-${discount}%</span>`
                    : `<span style="color: #888888; font-size: 12px;">No discount</span>`
            }
            ${
                discount > 0
                    ? `<span style="color: #738895; text-decoration: line-through; font-size: 13px; margin-left: 8px;">${inr(originalPrice)}</span>`
                    : ""
            }
            <span style="color: #4ade80; font-size: 20px; font-weight: bold; margin-left: 8px;">${inr(currentPrice)}</span>
        </div>

        <div style="color: #aaaaaa; font-size: 13px;">
            Your target price:
            <strong style="color: #ffffff;">${inr(targetPrice)}</strong>
        </div>

        ${
            isTargetReached
                ? `<div style="background-color: #14532d; color: #bbf7d0; padding: 8px 10px; border-radius: 6px; margin-top: 10px; font-size: 13px; font-weight: bold;">
            Your target price has been reached!
        </div>`
                : ""
        }

        <a
            href="https://store.steampowered.com/app/${esc(game.app_id)}/"
            style="display: inline-block; margin-top: 12px; background-color: #2563eb; color: #ffffff; padding: 9px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold;"
        >
            View on Steam
        </a>
    </div>
</div>`;
        })
        .join("");

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 20px 12px; background-color: #111111; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: auto;">
        <h1 style="color: #ffffff; font-size: 20px; text-align: center; margin: 0 0 6px;">
            Steam Price Alerts
        </h1>

        <p style="color: #999999; font-size: 13px; text-align: center; margin: 0 0 20px;">
            Here are your latest game prices.
        </p>

        ${gamesHTML}

        <p style="color: #666666; font-size: 11px; text-align: center; margin: 0;">
            Steam Game Price Tracker
        </p>
    </div>
</body>
</html>`;
}

export default createHTMLTemplate;