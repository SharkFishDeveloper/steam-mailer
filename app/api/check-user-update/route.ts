
import createHTMLTemplate from "@/util/createHTMLTemplate";
import { GAME } from "@/util/Game_Interface";
import { redis } from "@/util/redis";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const keys = await redis.keys("/games/game:*");

        const all_games = await Promise.all(
            keys.map(key => redis.get<GAME>(key))
        );

        const notifyForGames: GAME[] = [];

        all_games.forEach((game) => {
            if (!game || game.prices.length === 0) return;

            const latestPrice = game.prices[game.prices.length - 1];

            const currentPrice = Number(latestPrice.price) / 100;
            const targetPrice = Number(game.price_required);

            const today = new Date().toISOString().slice(0, 10);
            const isSameDay = latestPrice.date.slice(0, 10) === today;

            const previousPrice =
                game.prices.length > 1
                    ? Number(game.prices[game.prices.length - 2].price) / 100
                    : null;

            const targetReached = currentPrice <= targetPrice;

            const priceDropped =
                isSameDay &&
                previousPrice !== null &&
                currentPrice < previousPrice;

            if (targetReached || priceDropped) {
                notifyForGames.push(game);
            }
        });
        // No games matching the target price
        if (notifyForGames.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No games have reached their target price.",
                notified: 0
            });
        }

        // Generate HTML email
        const htmlTemplateForEmail = createHTMLTemplate(notifyForGames);

        // Send email using Resend
        const { data, error } = await resend.emails.send({
            from: "Steam Price Tracker <no-reply@codeheroes.online>",
            to: [process.env.ALERT_EMAIL!],
            subject: `${notifyForGames.length} Steam Game(s) Reached Your Target Price!`,
            html: htmlTemplateForEmail
        });

        if (error) {
            console.error("Resend error:", error);

            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: "Price alert email sent successfully!",
            notified: notifyForGames.length,
            email: data
        });

    } catch (error) {
        console.error("Internal server error:", error);

        return NextResponse.json({
            error: "Internal server error"
        }, { status: 500 });
    }
}
