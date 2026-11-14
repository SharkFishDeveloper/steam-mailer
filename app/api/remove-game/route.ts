
import { redis } from "@/util/redis";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
    try {
        const { app_id } = await req.json();

        if (!app_id) {
            return NextResponse.json(
                { error: "app_id is required" },
                { status: 400 }
            );
        }

        const key = `/games/game:${app_id}`;

        const game = await redis.get(key);

        if (!game) {
            return NextResponse.json(
                { error: "Game not found" },
                { status: 404 }
            );
        }

        await redis.del(key);

        return NextResponse.json({
            success: true,
            message: "Game removed successfully",
            app_id
        });

    } catch (error) {
        console.error("Remove game error:", error);

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
