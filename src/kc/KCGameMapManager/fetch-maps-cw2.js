/** @typedef {import("../KCGameMapManager").KCGameMapManager} KCGameMapManager */
/** @typedef {import("../KCGameMapManager").KCGameMapManagerOptions} KCGameMapManagerOptions */
/** @typedef {import("../KCGameMapManager").MapData} MapData */

import Discord from 'discord.js';
import { HttpRequest } from '../../utils/HttpRequest.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

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

    if(options.disableCW2) {
        logger.warn("[KCGameMapManager.fetchMapsCW2] WARNING. The debug flag \"disableCW2\" is enabled. Make sure this is NOT enabled in production. If this is in a production environment, shut off the bot immediately and change the flag.");
    }

    while(true) {
        let finished = await fetcher.call(this, options, currentPage, mapListTemp);
        if(finished) break;
        currentPage++;
        await Bot.Util.Promise.sleep(1000);
    }
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
    let data = await HttpRequest.get(URL + "&page=" + page);
    let exit = true;

    let i = 0;
    do {
        let obj = getCW2MapDataFromMapBrowser(data);
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
    if(exit || (options.disableCW2 && page >= 1)) {
        /** @type {MapData[]} */
        let arr = [];
        for(let obj of Array.from(mapListTemp.values())) arr.push(Object.freeze(obj));

        if(!options.disableCW2 && arr.length < 2500)
            throw "[KCGameMapManager.fetchMapsCW2] CW2 isn't disabled, but is finding less than 2500 maps.";

        this._maps.id.set("cw2", mapListTemp);
        this._maps.array.set("cw2", Object.freeze(arr));

        logger.info("[KCGameMapManager.fetchMapsCW2] End reached.");

        if(options.disableCW2) {
            logger.warn("[KCGameMapManager.fetchMapsCW2] WARNING. The debug flag \"disableCW2\" is enabled. Make sure this is NOT enabled in production. If this is in a production environment, shut off the bot immediately and change the flag.");
        }
        else logger.info("[KCGameMapManager.fetchMapsCW2] Page " + page + " contains no entries.");

        return true;
    }

    return false;
}

/**
 * Provided with the website source for the CW2 map browser, searches for the first instance of a map entry
 * and pulls all the information from it.
 * 
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
        desc = Bot.Util.String.replaceAll(desc, "&quot;", '"');
        desc = Bot.Util.String.replaceAll(desc, "&iexcl;", '!');

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