/** @typedef {import('winston').Logger} winston.Logger */
/** @typedef {import("../KCGameMapManager")} KCGameMapManager */
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
 * @param {winston.Logger} logger
 * @param {Discord.Collection<String, Discord.Collection<number, MapData>>} mapListByIds
 * @param {Discord.Collection<String, ReadonlyArray<MapData>>} mapListArray
 * @param {string} game //cw3 pf cw4
 * @returns {Promise<void>}
 */
export async function fetchMapsDefault(logger, mapListByIds, mapListArray, game) {
    let urlStr = KCLocaleManager.getUrlStringFromPrimaryAlias(game);
    if(urlStr == null) 
        throw "Specified game url does not exist.";

    let url = `https://knucklecracker.com/${urlStr}/queryMaps.php?query=maplist`;

    let xml = await HttpRequest.getGzipped(url);
    let data = await xml2js.parseStringPromise(xml);

    /** @type {Discord.Collection<number, MapData>} */
    const mapListTemp = new Discord.Collection();

    for(let j = 0; j < data.maps.m.length; j++) {
        let map = data.maps.m[j];

        if(game === 'cw4') {
            mapListTemp.set(+map.i[0], Object.freeze({
                id: +map.i[0],
                game: game,
                author: map.a[0],
                title: map.l[0],
                width: +map.w[0],
                height: +map.h[0],
                downloads: +map.o[0],
                rating: +map.b[0],
                tags: (map.s[0]+'').split(',')
            }));
        }
        else {
            mapListTemp.set(+map.i[0], Object.freeze({
                id: +map.i[0],
                game: game,
                author: map.a[0],
                title: map.l[0],
                width: +map.w[0],
                height: +map.h[0],
                desc: map.e[0],
                downloads: +map.o[0],
                scores: +map.s[0],
                rating: +map.r[0],
                ratings: +map.n[0],
            }));
        }
    }

    mapListByIds.set(game, mapListTemp);

    /** @type {MapData[]} */
    let arr = [];
    for(let obj of Array.from(mapListTemp.values()))
        arr.push(Object.freeze(obj));
    mapListArray.set(game, Object.freeze(arr));
}