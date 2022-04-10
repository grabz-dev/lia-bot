/** @typedef {import("../KCGameMapManager").KCGameMapManager} KCGameMapManager */
/** @typedef {import("../KCGameMapManager").KCGameMapManagerOptions} KCGameMapManagerOptions */
/** @typedef {import("../KCGameMapManager").MapData} MapData */

import Discord from 'discord.js';
import { HttpRequest } from '../../utils/HttpRequest.js';
import * as Bot from 'discord-bot-core';
import fs from 'fs';
import util from 'util';
const logger = Bot.logger;
// @ts-ignore
import he from 'he';

const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

const getMapDataFromMapBrowser = {
    'cw1': getCW1MapDataFromMapBrowser,
    'cw2': getCW2MapDataFromMapBrowser
}
const URLs = {
    cw2: "https://knucklecracker.com/creeperworld2/viewmaps.php?embedded=true&gameVer=0801",
    cw1: "https://knucklecracker.com/creeperworld/viewmaps.php?duration=&author=&search="
}

//https://knucklecracker.com/creeperworld/viewscores.php?missionGroup=special&groupfilter=
//https://knucklecracker.com/creeperworld/viewmaps.php?page=107&duration=&author=&search=

/**
 * Fetch Creeper World 2 map data.
 * 
 * @this {KCGameMapManager}
 * @param {KCGameMapManagerOptions} options
 * @param {"cw1"|"cw2"} game
 * @returns {Promise<void>}
 */
export async function fetchMaps(options, game) {
    /** @type {Discord.Collection<number, MapData>} */
    const mapListTemp = new Discord.Collection();
    let currentPage = 0;

    while(true) {
        let finished = await fetcher.call(this, options, game, currentPage, mapListTemp);
        if(finished) break;
        currentPage++;
        await Bot.Util.Promise.sleep(10000);
    }
}

/**
 * @this {KCGameMapManager}
 * @param {KCGameMapManagerOptions} options
 * @param {"cw1"|"cw2"} game
 * @returns {Promise<void>}
 */
export async function readCache(options, game) {
    const cache = await _readCache(options, game).catch(() => {});
    if(cache == null || typeof cache === 'string') {
        throw new Error(`[KCGameMapManager.readCache] ${cache == null ? 'Other error' : cache}`);
    }

    const arr = mapListArrFromEntries(cache);
    this._maps.id.set(game, cache);
    this._maps.array.set(game, Object.freeze(arr));
    this._maps.month.set(game, this.getMonthObjFromMapData.call(this, game, arr));

    logger.info(`[KCGameMapManager.readCache] Cache loaded for ${game}`)
}

/**
 * @param {KCGameMapManagerOptions} options
 * @param {"cw1"|"cw2"} game
 * @returns {Promise<Discord.Collection<number, MapData>|string>}
 */
async function _readCache(options, game) {
    const now = Date.now();
    const cache = await readFile(`cache/maps-${game}`).catch(() => {});
    if(cache == null) return `Cache missing or unreadable for ${game}`;
    const json = JSON.parse(cache.toString());

    //Don't really need this
    //if(now - json.timestamp >= options.cacheTimeCW2) {
    //    return "Cache too old";
    //}
    
    /** @type {Discord.Collection<number, MapData>} */
    const data = new Discord.Collection();

    for(const entry of Object.entries(json.data)) {
        data.set(+entry[0], entry[1]);
    }

    return data;
}

/**
 * @param {"cw1"|"cw2"} game
 * @param {Discord.Collection<number, MapData>} mapList 
 */
async function writeCache(game, mapList) {
    const now = Date.now();
    await mkdir('cache').catch(() => {});

    const data = Object.fromEntries(mapList);
    const json = {
        timestamp: now,
        data: data
    }

    await writeFile(`cache/maps-${game}`, JSON.stringify(json)).catch(() => {});
}

/**
 * Repeatedly run fetcher and increment the page until we reach a page with no more maps left, then quit.
 * @this {KCGameMapManager}
 * @param {KCGameMapManagerOptions} options
 * @param {"cw1"|"cw2"} game
 * @param {number} page 
 * @param {Discord.Collection<number, MapData>} mapListTemp
 * @returns {Promise<boolean>} true if finished, false if not
 */
async function fetcher(options, game, page, mapListTemp) {
    //Fetch all maps from the current page.
    while(true) {
        try {
            var data = await HttpRequest.get(URLs[game] + "&page=" + page);
            break;
        }
        catch(err) {
            logger.error(err);
            continue;
        }
    }

    let exit = true;

    let i = 0;
    do {
        let obj = getMapDataFromMapBrowser[game].call(this, data, game);
        var mapData = obj.mapData;
        data = obj.data;

        if(mapData && mapData.id) {
            mapListTemp.set(mapData.id, mapData);
            i++;
        }
    }
    while(mapData != null);

    if(i > 0) exit = false;

    logger.info(`[KCGameMapManager.fetchMaps] Fetching from ${game} web browser. Page ${page}.`);

    //If no maps were found on the current page, we finalize and quit.
    if(exit) {
        const arr = mapListArrFromEntries(mapListTemp);

        this._maps.id.set(game, mapListTemp);
        this._maps.array.set(game, Object.freeze(arr));
        this._maps.month.set(game, this.getMonthObjFromMapData.call(this, game, arr));

        logger.info(`[KCGameMapManager.fetchMaps] End reached for ${game}. Page ${page} contains no entries.`);

        await writeCache(game, mapListTemp).catch(() => {});
        logger.info(`[KCGameMapManager.fetchMaps] Cache updated for ${game}.`);

        return true;
    }

    return false;
}

/**
 * 
 * @param {Discord.Collection<number, MapData>} mapListTemp 
 * @returns {MapData[]}
 */
function mapListArrFromEntries(mapListTemp) {
    /** @type {MapData[]} */
    let arr = [];
    for(let obj of Array.from(mapListTemp.values())) arr.push(Object.freeze(obj));
    return arr;
}

/**
 * Provided with the website source for the CW2 map browser, searches for the first instance of a map entry
 * and pulls all the information from it.
 * @this {KCGameMapManager}
 * @param {string} data - The website source of the CW2 map browser.
 * @param {"cw1"|"cw2"} game
 * @returns {import("../KCGameMapManager").MapBrowserData}
 */
function getCW2MapDataFromMapBrowser(data, game) {
    let index = data.indexOf("<div>Map ID: ");
    if(index > 0) {
        data = data.substring(index);

        let id = data.substring(13, data.indexOf("</div>")).trim();
        data = data.substring(data.indexOf("</div>"));

        data = data.substring(data.indexOf('<span class="result">'));
        data = data.substring(21);
        data = data.substring(data.indexOf(">"));
        let upvotes = data.substring(1, data.indexOf("<")).trim();

        data = data.substring(data.indexOf("</span>"));
        data = data.substring(7);
        data = data.substring(data.indexOf(">"));
        let downvotes = data.substring(1, data.indexOf("<")).trim();

        data = data.substring(data.indexOf("Title:</td>"));
        data = data.substring(11);
        data = data.substring(data.indexOf(">"));
        let title = data.substring(1, data.indexOf("<")).trim();

        data = data.substring(data.indexOf("Author:</td>"));
        data = data.substring(12);
        data = data.substring(data.indexOf(">"));
        data = data.substring(1);
        data = data.substring(data.indexOf(">"));
        let author = data.substring(1, data.indexOf("<")).trim();

        data = data.substring(data.indexOf("Comments:</td>"));
        data = data.substring(data.indexOf("?topic="));
        data = data.substring(7);
        let forumId = data.substring(0, data.indexOf('&')).trim();

        data = data.substring(data.indexOf("Scores:</td>"));
        data = data.substring(12);
        data = data.substring(data.indexOf(">"));
        data = data.substring(1);
        data = data.substring(data.indexOf(">"));
        let scores = data.substring(1, data.indexOf("&nbsp")).trim();

        data = data.substring(data.indexOf("Height:</td>"));
        data = data.substring(12);
        data = data.substring(data.indexOf(">"));
        let height = data.substring(1, data.indexOf("<")).trim();

        data = data.substring(data.indexOf("Downloads:</td>"));
        data = data.substring(15);
        data = data.substring(data.indexOf(">"));
        let downloads = data.substring(1, data.indexOf("<")).trim();

        data = data.substring(data.indexOf("Desc:</td>"));
        data = data.substring(10);
        data = data.substring(data.indexOf(">"));
        data = data.substring(1);
        data = data.substring(data.indexOf(">"));

        let desc = data.substring(1, data.indexOf("<")).trim();

        desc = he.decode(desc);
        title = he.decode(title);
        author = he.decode(author);

        let _map = this._cw2Maps[id];

        let timestamp;
        if(_map != null) {
            timestamp = _map.timestamp;
        }

        return {
            data: data,
            game: game,
            mapData: Object.freeze({
                id: +id,
                game: "cw2",
                upvotes: +upvotes,
                downvotes: +downvotes,
                title: title,
                author: author,
                scores: +scores,
                height: +height,
                width: 32,
                downloads: +downloads,
                desc: desc,
                forumId: +forumId,
                timestamp: timestamp
            })
        }
    }
    else {
        return {
            data: data,
            game: game,
            mapData: null
        }
    }
}

/**
 * Provided with the website source for the CW2 map browser, searches for the first instance of a map entry
 * and pulls all the information from it.
 * @this {KCGameMapManager}
 * @param {string} data - The website source of the CW2 map browser.
 * @param {"cw1"|"cw2"} game
 * @returns {import("../KCGameMapManager").MapBrowserData}
 */
 function getCW1MapDataFromMapBrowser(data, game) {
    let index = data.indexOf("Skill: ");
    if(index > 0) {
        data = data.substring(data.substring(0, index).lastIndexOf("<table"));
        data = data.substring(data.indexOf('<td'));

        data = data.substring(data.indexOf('>') + 1);
        let title = data.substring(0, data.indexOf('<')).trim();

        data = data.substring(data.indexOf('By:') + 3);
        data = data.substring(data.indexOf('>') + 1);
        let author = data.substring(0, data.indexOf('<')).trim();

        data = data.substring(data.indexOf('Downloads:') + 10);
        let downloads = data.substring(0, data.indexOf('<')).trim();

        data = data.substring(data.indexOf('Scores:') + 7);
        let scores = data.substring(0, data.indexOf('<')).trim();

        data = data.substring(data.indexOf('?id=') + 4);
        let id = data.substring(0, data.indexOf('&')).trim();

        title = he.decode(title);
        author = he.decode(author);

        let _map = this._cw1Maps[id];

        let timestamp;
        let rating;
        let ratings;
        let desc;
        let forumId;
        if(_map != null) {
            title = _map.title;
            rating = _map.rating;
            ratings = _map.ratings;
            desc = _map.desc;
            forumId = _map.forumId;
            timestamp = _map.timestamp;
        }

        return {
            data: data,
            game: game,
            mapData: Object.freeze({
                id: +id,
                game: "cw1",
                title: title,
                author: author,
                scores: +scores,
                downloads: +downloads,
                rating,
                ratings,
                desc,
                forumId,
                timestamp
            })
        }
    }
    else {
        return {
            data: data,
            game: game,
            mapData: null
        }
    }
}