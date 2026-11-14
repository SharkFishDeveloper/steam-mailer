import { redis } from "@/util/redis";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req:NextRequest){
    try {
        const keys = await redis.keys("/games/game:*");
        const all_games = await Promise.all(
            keys.map(key => redis.get(key)) 
        )
        return NextResponse.json({
            all_games_data:all_games
        })

    } catch (error) {
        console.error("Internal server error")
        return NextResponse.json({
            error:"Internal server error"
        },{status:500})
    }
}