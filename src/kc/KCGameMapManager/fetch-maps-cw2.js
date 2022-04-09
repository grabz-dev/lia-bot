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

const URL = "https://knucklecracker.com/creeperworld2/viewmaps.php?embedded=true&gameVer=0801";

/**
 * Fetch Creeper World 2 map data.
 * 
 * @this {KCGameMapManager}
 * @param {KCGameMapManagerOptions} options
 * @returns {Promise<void>}
 */
export async function fetchMapsCW2(options) {
    /** @type {Discord.Collection<number, MapData>} */
    const mapListTemp = new Discord.Collection();
    let currentPage = 0;

    while(true) {
        let finished = await fetcher.call(this, options, currentPage, mapListTemp);
        if(finished) break;
        currentPage++;
        await Bot.Util.Promise.sleep(1000);
    }
}

/**
 * @this {KCGameMapManager}
 * @param {KCGameMapManagerOptions} options
 * @returns {Promise<void>}
 */
export async function readCacheCW2(options) {
    const cache = await readCache(options).catch(() => {});
    if(cache == null || typeof cache === 'string') {
        throw new Error(`[KCGameMapManager.readCacheCW2] ${cache == null ? 'Other error' : cache}`);
    }

    const arr = mapListArrFromEntries(cache);
    this._maps.id.set("cw2", cache);
    this._maps.array.set("cw2", Object.freeze(arr));
    this._maps.month.set("cw2", this.getMonthObjFromMapData.call(this, 'cw2', arr));

    logger.info(`[KCGameMapManager.readCacheCW2] Cache loaded`)
}

/**
 * @param {KCGameMapManagerOptions} options
 * @returns {Promise<Discord.Collection<number, MapData>|string>}
 */
async function readCache(options) {
    const now = Date.now();
    const cache = await readFile('cache/maps-cw2').catch(() => {});
    if(cache == null) return "Cache missing or unreadable";
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
 * 
 * @param {Discord.Collection<number, MapData>} mapList 
 */
async function writeCache(mapList) {
    const now = Date.now();
    await mkdir('cache').catch(() => {});

    const data = Object.fromEntries(mapList);
    const json = {
        timestamp: now,
        data: data
    }

    await writeFile('cache/maps-cw2', JSON.stringify(json)).catch(() => {});
}

/**
 * Repeatedly run fetcher and increment the page until we reach a page with no more maps left, then quit.
 * @this {KCGameMapManager}
 * @param {KCGameMapManagerOptions} options
 * @param {number} page 
 * @param {Discord.Collection<number, MapData>} mapListTemp
 * @returns {Promise<boolean>} true if finished, false if not
 */
async function fetcher(options, page, mapListTemp) {
    //Fetch all maps from the current page.
    while(true) {
        try {
            var data = await HttpRequest.get(URL + "&page=" + page);
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
        let obj = getCW2MapDataFromMapBrowser.call(this, data);
        var mapData = obj.mapData;
        data = obj.data;

        if(mapData && mapData.id) {
            mapListTemp.set(mapData.id, mapData);
            i++;
        }
    }
    while(mapData != null);

    if(i > 0) exit = false;

    logger.info("[KCGameMapManager.fetchMapsCW2] Fetching from CW2 web browser. Page " + page + ".");

    //If no maps were found on the current page, we finalize and quit.
    if(exit) {
        const arr = mapListArrFromEntries(mapListTemp);

        this._maps.id.set("cw2", mapListTemp);
        this._maps.array.set("cw2", Object.freeze(arr));
        this._maps.month.set("cw2", this.getMonthObjFromMapData.call(this, 'cw2', arr));

        logger.info("[KCGameMapManager.fetchMapsCW2] End reached. Page " + page + " contains no entries.");

        await writeCache(mapListTemp).catch(() => {});
        logger.info("[KCGameMapManager.fetchMapsCW2] Cache updated.");

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
 * @returns {import("../KCGameMapManager").MapBrowserDataCW2}
 */
function getCW2MapDataFromMapBrowser(data) {
    let index = data.indexOf("<div>Map ID: ");
    if(index > 0) {
        data = data.substring(index);

        let id = data.substring(13, data.indexOf("</div>"));
        data = data.substring(data.indexOf("</div>"));

        data = data.substring(data.indexOf('<span class="result">'));
        data = data.substring(21);
        data = data.substring(data.indexOf(">"));
        let upvotes = data.substring(1, data.indexOf("<"));

        data = data.substring(data.indexOf("</span>"));
        data = data.substring(7);
        data = data.substring(data.indexOf(">"));
        let downvotes = data.substring(1, data.indexOf("<"));

        data = data.substring(data.indexOf("Title:</td>"));
        data = data.substring(11);
        data = data.substring(data.indexOf(">"));
        let title = data.substring(1, data.indexOf("<"));

        data = data.substring(data.indexOf("Author:</td>"));
        data = data.substring(12);
        data = data.substring(data.indexOf(">"));
        data = data.substring(1);
        data = data.substring(data.indexOf(">"));
        let author = data.substring(1, data.indexOf("<"));

        data = data.substring(data.indexOf("Comments:</td>"));
        data = data.substring(data.indexOf("?topic="));
        data = data.substring(7);
        let forumId = data.substring(0, data.indexOf('&'));

        data = data.substring(data.indexOf("Scores:</td>"));
        data = data.substring(12);
        data = data.substring(data.indexOf(">"));
        data = data.substring(1);
        data = data.substring(data.indexOf(">"));
        let scores = data.substring(1, data.indexOf("&nbsp"));

        data = data.substring(data.indexOf("Height:</td>"));
        data = data.substring(12);
        data = data.substring(data.indexOf(">"));
        let height = data.substring(1, data.indexOf("<"));

        data = data.substring(data.indexOf("Downloads:</td>"));
        data = data.substring(15);
        data = data.substring(data.indexOf(">"));
        let downloads = data.substring(1, data.indexOf("<"));

        data = data.substring(data.indexOf("Desc:</td>"));
        data = data.substring(10);
        data = data.substring(data.indexOf(">"));
        data = data.substring(1);
        data = data.substring(data.indexOf(">"));

        let desc = data.substring(1, data.indexOf("<"));

        desc = he.decode(desc);
        title = he.decode(title);
        author = he.decode(author);

        const timestamp = this._cw2uploadDates[id];

        return {
            data: data,
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
            mapData: null
        }
    }
}