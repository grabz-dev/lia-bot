/** @typedef {import("../KCGameMapManager").KCGameMapManager} KCGameMapManager */
/** @typedef {import("../KCGameMapManager").KCGameMapManagerOptions} KCGameMapManagerOptions */
/** @typedef {import("../KCGameMapManager").MapData} MapData */

import Discord from 'discord.js';
import xml2js from 'xml2js';
import { HttpRequest } from '../../utils/HttpRequest.js';
import { KCLocaleManager } from '../../kc/KCLocaleManager.js';
import { KCUtil } from '../KCUtil.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

/**
 * Fetch map data. Confirmed to work for CW4, CW3 and PF.
 * 
 * @this {KCGameMapManager}
 * @param {string} game //cw3 pf cw4
 * @returns {Promise<void>}
 */
export async function fetchMapsDefault(game) {
    let urlStr = KCLocaleManager.getUrlStringFromPrimaryAlias(game);
    if(urlStr == null) 
        throw "Specified game url does not exist.";

    let url = `https://knucklecracker.com/${urlStr}/queryMaps.php?query=maplist`;

    let xml = await HttpRequest.getGzipped(url);
    let data = await xml2js.parseStringPromise(xml);

    const temp = {
        /** @type {Discord.Collection<number, MapData>} */
        id: new Discord.Collection(),
        /** @type {Object.<number, MapData[]>} */
        month: {}
    }

    for(let j = 0; j < data.maps.m.length; j++) {
        let map = data.maps.m[j];

        //Fill shared map properties
        const shared = {
            id: +map.i[0],
            game: game,
            author: map.a[0],
            title: map.l[0],
            width: +map.w[0],
            height: +map.h[0],
            downloads: +map.o[0],
            timestamp: +(map.t[0]+'000')
        }

        let obj;
        //Fill CW4 game properties
        if(game === 'cw4') {
            obj = Object.assign(Object.assign({}, shared), {
                upvotes: +map.b[0],
                tags: (map.s[0]+'').split(',')
            });
        }
        //Fill CW3 and PF game properties
        else {
            obj = Object.assign(Object.assign({}, shared), {
                desc: map.e[0],
                scores: +map.s[0],
                rating: +map.r[0],
                ratings: +map.n[0],
            });
        }

        //Get month the map was uploaded in
        const date = KCUtil.getDateFlooredToMonth(new Date(obj.timestamp));
        const time = date.getTime();
        if(temp.month[time] == null) temp.month[time] = [];

        //Set all temp objects
        temp.id.set(+map.i[0], obj);
        temp.month[time].push(obj);
    }

    //Delete current month only
    delete temp.month[+Object.keys(temp.month).reduce((a, b) => +b > +a ? +b : +a, 0)];
    //Build map array
    /** @type {MapData[]} */
    let arr = [];
    for(let obj of Array.from(temp.id.values())) arr.push(Object.freeze(obj));

    //Build map month
    for(let key of Object.keys(temp.month)) {
        let maps = temp.month[+key];

        switch(game) {
        case 'cw3':
        case 'pf':
            maps.sort((a, b) => (b.rating||0) - (a.rating||0));
        case 'cw4':
            maps.sort((a, b) => (b.upvotes||0) - (a.upvotes||0));
        }
    }

    this._maps.id.set(game, temp.id);
    this._maps.array.set(game, Object.freeze(arr));
    this._maps.month.set(game, temp.month);
}