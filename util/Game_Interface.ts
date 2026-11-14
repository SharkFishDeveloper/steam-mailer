export interface SINGLE_GAME {
    name:string,
    app_id:string,
    image:string,
    initial_price:string,
    final_price:string,
    discount_percent:string
}

export interface MULTIPLE_GAMES{
    games:SINGLE_GAME[]
}

export interface GAME{
    image:string,
    name:string,
    app_id:string,
    price_required:string,
    original_price:string,
    prices:{
        date:string,
        price:string
    }[]
}