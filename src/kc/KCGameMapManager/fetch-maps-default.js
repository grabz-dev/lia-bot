/** @typedef {import("../KCGameMapManager").KCGameMapManager} KCGameMapManager */
/** @typedef {import("../KCGameMapManager").KCGameMapManagerOptions} KCGameMapManagerOptions */
/** @typedef {import("../KCGameMapManager").MapData} MapData */

import Discord from 'discord.js';
import xml2js from 'xml2js';
import { HttpRequest } from '../../utils/HttpRequest.js';
import { KCLocaleManager } from '../../kc/KCLocaleManager.js';
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


    try {
        var xml = await HttpRequest.getGzipped(url);
    }
    catch(err) {
        throw err;
    }

    
    let data = await xml2js.parseStringPromise(xml);

    const temp = {
        /** @type {Discord.Collection<number, Readonly<MapData>>} */
        id: new Discord.Collection(),
    }

    for(let j = 0; j < data.maps.m.length; j++) {
        let map = data.maps.m[j];

        //Fill shared map properties
        const shared = {
            guid: map.g[0],
            id: +map.i[0],
            game: game,
            author: map.a[0],
            title: map.l[0],
            timestamp: +(map.t[0]+'000'),
            forumId: +map.p[0]
        }

        let obj;

        //Fill IXE game properties
        if(game === 'ixe') {
            obj = Object.assign(Object.assign({}, shared), {
                upvotes: +map.b[0],
                tags: (map.s[0]+'').toUpperCase().split(','),
                version: +map.v[0],
                discordId: map.z[0]
            });
        }
        //Fill CW4 game properties
        else if(game === 'cw4') {
            obj = Object.assign(Object.assign({}, shared), {
                width: +map.w[0],
                height: +map.h[0],
                upvotes: +map.b[0],
                tags: (map.s[0]+'').toUpperCase().split(','),
                objectives: +map.o[0],
                version: +map.v[0],
                discordId: map.z[0]
            });
        }
        //Fill CW3 and PF game properties
        else {
            obj = Object.assign(Object.assign({}, shared), {
                width: +map.w[0],
                height: +map.h[0],
                desc: map.e[0],
                scores: +map.s[0],
                rating: +map.r[0],
                ratings: +map.n[0],
                downloads: +map.o[0]
            });
        }

        //Get month the map was uploaded in
        const date = this.getDateFlooredToMonth(new Date(obj.timestamp));
        const time = date.getTime();

        //Freeze
        obj = Object.freeze(obj);

        //Set all temp objects
        temp.id.set(+map.i[0], obj);
    }

    //Build map array
    /** @type {Readonly<MapData>[]} */
    let arr = [];
    for(let obj of Array.from(temp.id.values())) arr.push(Object.freeze(obj));

    this._maps.id.set(game, temp.id);
    this._maps.array.set(game, Object.freeze(arr));
    this._maps.month.set(game, this.getMonthObjFromMapData.call(this, game, arr));
}