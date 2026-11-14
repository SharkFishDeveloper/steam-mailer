import { GAME } from "@/util/Game_Interface";
import getSteamGameScraperUrl from "@/util/getGameScrapUrl";
import { redis } from "@/util/redis";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req:NextRequest){
    try {
        const keys:string[]|null = await redis.keys("/games/game:*");
        if(!keys){
            throw new Error("Couldn't fetch redis keys")
        }
        const games_ids = keys.map(key=>key.split(":")[1]); 
        let ids_skipped = 0;
        const games:GAME[] = []
        await Promise.all(
            games_ids.map(async(game_id,index)=>{
                const STEAM_URL = getSteamGameScraperUrl(game_id);
                const res = await fetch(STEAM_URL);
                const gameObj = await res.json() 
                const data = gameObj[game_id].data
                const final_price = data.price_overview.final;
                const game = await redis.get<GAME>(`/games/game:${game_id}`);
                if(!game){
                    ids_skipped++;
                    return
                }
                if(game){
                    if(game.prices.length === 0){
                        game.prices.push({
                            date: new Date().toISOString(),
                            price:final_price
                        })    
                    }
                    else if(game.prices[game.prices.length-1].price !== final_price){
                        game.prices.push({
                            date: new Date().toISOString(),
                            price:final_price
                        }) 
                    }
                }
                redis.set(`/games/game:${game_id}`,game)
                games.push(game)
            })
        )
        return NextResponse.json({
            message: ids_skipped !== games_ids.length ? `${ids_skipped} games skipped` : `All games crawled`
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json({error:"Internal server error"},{status:500})
    }
}