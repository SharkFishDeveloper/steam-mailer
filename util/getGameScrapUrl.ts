const getSteamGameScraperUrl = (APP_ID:string):string=>{
    const URL = `https://store.steampowered.com/api/appdetails?appids=${APP_ID}&cc=in`
    return URL;
}

export default getSteamGameScraperUrl;