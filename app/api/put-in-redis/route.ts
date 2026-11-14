import getSteamGameScraperUrl from "@/util/getGameScrapUrl";
import { redis } from "@/util/redis";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req:NextRequest){
    try {
        const body = await req.json();
        const {game_url,price}:{game_url:string,price:string} = body;
        if(!game_url || !price){
            return NextResponse.json({
                message:"Price is required"
            },{status:301})
        }
        const APP_ID = game_url.split("/")[4];

        const STEAM_URL = getSteamGameScraperUrl(APP_ID);
        const res = await fetch(STEAM_URL) ?? null;
        if(!res.ok){
            throw new Error("URL cannot be scrapped")
        }
        const gameObj = await res.json() 
        const data = gameObj[APP_ID].data
        const name = data.name;
        const image = data.header_image;
        const original_price = data.price_overview.initial;


        const game = {
            app_id:APP_ID,
            name,
            image,
            price_required : price,
            original_price,
            prices:[]
        }
        await redis.set(`/games/game:${APP_ID}`,game);
        return NextResponse.json({
            message:"Saved successfully"
        })

    } catch (error) {
        return NextResponse.json({
            error:"Internal server error"
        },{status:500})
    }
}