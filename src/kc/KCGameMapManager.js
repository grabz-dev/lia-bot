"use strict";

/**
 * @typedef {object} KCGameMapManagerOptions
 * @property {boolean} disableCW2 - Disable lookup of maps for CW2 past the first page. Useful for debugging to prevent the bot from 
 */

/**
 * @typedef {object} MapScoreQueryData
 * @property {string} game - cw2 cw3 pf cw4
 * @property {string} type - CW2: custom, code | CW3: custom, dmd | PF: custom
 * @property {number=} id - Works for everything except CW2 code maps. Map ID number.
 * @property {string=} name - CW2 code map only. The map seed
 * @property {number=} size - CW2 code map only. 0, 1, 2 - small, medium, large
 * @property {number=} complexity - CW2 code map only. 0, 1, 2 - low, medium, high
 */

/**
 * @typedef {object} MapData
 * @property {number} id - The id of the map.
 * @property {string} game - cw2, cw3, pf, cw4
 * @property {string} author - The name of the author.
 * @property {string} title - The title of the map.
 * @property {number} width - The width of the map.
 * @property {number} height - The height of the map.
 * @property {string=} desc - The map description. CW2, CW3 and PF only.
 * @property {number} downloads - The amount of times the map was downloaded.
 * @property {number=} scores - The amount of scores submitted. CW2, CW3 and PF only.
 * @property {number=} rating - PF and CW3 only. The rating of the map.
 * @property {number=} ratings - PF and CW3 only. The amount of ratings submitted.
 * @property {number=} upvotes - CW2 and CW4 only. The amount of times this map was rated up.
 * @property {number=} downvotes - CW2 only. The amount of times this map was rated down.
 * @property {string[]=} tags - CW4 only. The tags on this map.
 * @property {number=} timestamp - Map upload unix timestamp. CW3, PF, CW4 only.
 */

/**
 * @typedef {object} MapBrowserDataCW2
 * @property {string} data - The original website source data string, cut off after the map that was last found.
 * @property {MapData | null} mapData - The scraped map data, or null if no map was found. If null, should move to next page.
 */

/**
 * @typedef {object} MapLeaderboardEntry
 * @property {number} rank - The user's place on the leaderboard.
 * @property {string} user - The name of the user.
 * @property {number=} score - The user's score. Not applicable to PF leaderboards.
 * @property {number} time - The time it took to finish the level, in frames.
 * @property {number} plays - The amount of times the user submitted a score.
 */

/**
 * @typedef {object} MapLeaderboard
 * @property {MapLeaderboardEntry[]} entries - All leaderboard entries.
 */

/** @typedef {import('discord-bot-core/src/structures/Locale').Locale} Core.Locale */

import Discord from 'discord.js';
import crypto from 'crypto';
import xml2js from 'xml2js';
import { logger } from 'discord-bot-core';
import { HttpRequest } from '../utils/HttpRequest.js';
import { KCLocaleManager } from '../kc/KCLocaleManager.js';

import { fetchMapsDefault } from './KCGameMapManager/fetch-maps-default.js';
import { fetchMapsCW2 } from './KCGameMapManager/fetch-maps-cw2.js';

/**
 * @class
 * @param {KCGameMapManagerOptions} options
 * @param {Core.Locale} locale
 */
export function KCGameMapManager(options, locale) {
    this._maps = Object.freeze({
        /** @type {Discord.Collection<string, Discord.Collection<number, MapData>>} */
        id: new Discord.Collection(),
        /** @type {Discord.Collection<string, ReadonlyArray<MapData>>} */
        array: new Discord.Collection(),
        /** @type {Discord.Collection<string, Object.<number, MapData[]>>} */
        month: new Discord.Collection(),
    });

    const minFetchInterval = 1000 * 60;
    let lastFetchTimestamp = 0;

    /**
     * Get leaderboards for a map
     * @throws Error
     * @param {MapScoreQueryData} mapScoreQueryData -
     * @param {string=} groupName
     * @returns {Promise<MapLeaderboard>} 
     */
    this.getMapScores = async function(mapScoreQueryData, groupName) {
        const url = getScoreQueryURL(mapScoreQueryData, groupName);
        if(url == null)
            throw "Invalid score query data " + JSON.stringify(mapScoreQueryData);

        const game = mapScoreQueryData.game;
        const xml = await HttpRequest.get(url);
        
        let data = await xml2js.parseStringPromise(xml);
        /** @type {MapLeaderboard} */
        let leaderboard = {
            entries: []
        };

        if(!(data.records.record instanceof Array))
            return leaderboard;

        for(let dataEntry of data.records.record) {
            let rank = +dataEntry.rank[0];
            let user = dataEntry.user[0]+'';
            let score = dataEntry.score == null ? undefined : +dataEntry.score[0];
            let time = +dataEntry.time[0];
            let plays = +dataEntry.plays[0];

            //Increase rank by 1 for PF leaderboards because they start at 0.
            if(game === "pf")
                rank++;

            /** @type {MapLeaderboardEntry} */
            let entry = {
                rank: rank,
                user: user,
                score: score,
                time: time,
                plays: plays
            };

            leaderboard.entries.push(entry);
        }

        leaderboard.entries.sort((a, b) => {
            return a.rank - b.rank;
        });

        return leaderboard;
    }

    /**
     * Check whether a user has an entry in the leaderboards for a map.
     * @throws Error
     * @param {MapScoreQueryData} mapScoreQueryData
     * @param {string} name - The name of the user.
     * @param {string=} groupName - The group name.
     * @returns {Promise<boolean>}
     */
    this.getMapCompleted = async function(mapScoreQueryData, name, groupName) {
        let leaderboard = await this.getMapScores(mapScoreQueryData, groupName);
        return !!leaderboard.entries.find(entry => entry.user === name);
    }
    
    /**
     * Returns map list array sorted by ID's
     * @param {string} game //cw2 cw3 pf cw4
     * @returns {MapData[] | null}
     */
    this.getMapListArray = function(game) {
        let mapList = this._maps.array.get(game);
        return mapList ? mapList.slice() : null;
    }

    /**
     * Returns map list collection mapped by ID's
     * @param {string} game //cw2 cw3 pf cw4
     * @returns {Discord.Collection<number, MapData> | null} Collection mapped by map ID
     */
    this.getMapListId = function(game) {
        let mapList = this._maps.id.get(game);
        return mapList ? mapList.clone() : null;
    }

    /**
     * Returns map list array for specific month sorted from best to worst
     * @param {string} game //cw3 pf cw4
     * @param {number} timestamp
     * @returns {MapData[] | null}
     */
    this.getMapListMonth = function(game, timestamp) {
        let mapList = this._maps.month.get(game);
        if(!mapList) return null;
        if(mapList[timestamp] == null) return [];
        return mapList[timestamp].slice();
    }

    /**
     * Updates the map database cache.
     * A call to this is required to pull maps, and subsequently new maps.
     * 
     * @throws Error
     * @param {string} game //cw2 cw3 pf cw4
     * @returns {Promise<void>}
     */
    this.fetch = async function(game) {
        const now = Date.now();
        if(now - lastFetchTimestamp < minFetchInterval) {
            throw `[KCGameMapManager.fetch] Must wait another ${(lastFetchTimestamp + minFetchInterval - now) / 1000}s to fetch.`;
        }

        try {
            await fetchMapData.call(this, game);
            logger.info(`[KCGameMapManager.fetch] Fetched map data for ${game}.`);
            lastFetchTimestamp = Date.now();
        }
        catch(err) {
            logger.warn(`[KCGameMapManager.fetch] Failed to fetch map data for ${game}. ${err} ${err.stack}`);
        }
    }

    /**
     * Retrieve a map query object from command arguments.
     * @param {string[]} args
     * @returns {{data: MapScoreQueryData, err: string|null}}
     */
    this.getMapQueryObjectFromCommandParameters = function(args) {
        /** @type {Object.<string, any>} */
        const obj = {};

        /** @type {string|null} */
        let err = null;

        (() => {
            //Provide game name
            if(args[0] == null) {err = "no_game"; return;}

            //Is game name valid
            var game = KCLocaleManager.getPrimaryAliasFromAlias('game', args[0]);
            if(game == null) {err = "bad_game"; return;}
            obj.game = game;

            //Provide map type
            if(args[1] == null) {err = "no_type"; return;}
            obj.type = args[1];

            let index = 1;

            //If the second argument (type) is "custom", "dmd" or "code", that means the type
            //specified is explicit, and the third argument is where the rest of the parameters start.
            //If the second argument (type) is neither of those, that means the type
            //will be computed based on the amount of parameters specified.
            if(!["custom", "dmd", "code"].includes(obj.type)) {
                //If there are 3 or more arguments, assume we're dealing with a code map.
                if(game === "cw2" && args.length >= 3) {
                    const size = KCLocaleManager.getPrimaryAliasFromAlias("cw2_code_map_size", args[index]);

                    //If a 4th argument exists, assume it's a code map.
                    //Otherwise we're unable to determine type.
                    if(size)
                        obj.type = "code";
                    else
                        {err = "bad_type"; return;}
                }
                else
                    obj.type = "custom";
            }
            else
                index++;

            if(obj.type === "dmd" && obj.game !== "cw3") {err = "bad_type"; return;}
            
            if(obj.type === "code") {
                if(obj.game !== "cw2") {err = "bad_type"; return;}

                if(args[index] == null) {err = "no_cw2_code_size"; return;}
                const size = KCLocaleManager.getPrimaryAliasFromAlias("cw2_code_map_size", args[index]);
                if(size == null) {err = "bad_cw2_code_size"; return;};
                obj.size = Number(size);
                if(![0,1,2].includes(obj.size)) {err = "bad_cw2_code_size"; return;}
                
                if(args[index + 1] == null) {err = "no_cw2_code_complexity"; return;}
                const complexity = KCLocaleManager.getPrimaryAliasFromAlias("cw2_code_map_complexity", args[index + 1]);
                if(complexity == null) {err = "bad_cw2_code_complexity"; return;};
                obj.complexity = Number(complexity);
                if(![0,1,2].includes(obj.complexity)) {err = "bad_cw2_code_complexity"; return;}
                
                let name = "";
                for(let i = index + 2; i < args.length; i++) {
                    name += args[i];
                    if(i + 1 < args.length)
                        name += " ";
                }

                if(name.length === 0) {err = "no_cw2_code_name"; return;}
                obj.name = name;
            }
            else {
                if(args[index] == null) {err = "no_id"; return;}

                obj.id = Math.floor(+args[index]);

                if(Number.isNaN(obj.id) || !Number.isFinite(obj.id) || obj.id <= 0) {err = "bad_id"; return;}
            }
        })();

        // @ts-ignore
        return {data: obj, err: err == null ? null : locale.category("kcgmm", err)};
    }

    /**
     * Fetch map data.
     * @this {KCGameMapManager}
     * @param {string} game //cw2 cw3 pf cw4
     */
    async function fetchMapData(game) {
        if(game === "cw2")
            await fetchMapsCW2.call(this, options);
        else
            await fetchMapsDefault.call(this, game);
    }

    /**
     * Get a ready to go URL for a map search query.
     * @param {MapScoreQueryData} mapScoreQueryData
     * @param {string=} groupName
     * @returns {string | null} - The URL
     */
    function getScoreQueryURL(mapScoreQueryData, groupName) {
        if(!mapScoreQueryData.game) return null;
        
        let gameUrlParam = KCLocaleManager.getUrlStringFromPrimaryAlias(mapScoreQueryData.game);

        switch(mapScoreQueryData.type) {
            case "custom":
                if(mapScoreQueryData.id == null) return null;
                return `https://knucklecracker.com/${gameUrlParam}/scoreQuery.php?customID=${mapScoreQueryData.id}&groupfilter=${groupName?groupName:""}`;
            case "dmd":
                if(mapScoreQueryData.id == null) return null;
                return `https://knucklecracker.com/${gameUrlParam}/scoreQuery.php?dmdID=${mapScoreQueryData.id}&groupfilter=${groupName?groupName:""}`;
            case "code":
                if(mapScoreQueryData.name == null) return null;
                if(mapScoreQueryData.size == null) return null;
                if(mapScoreQueryData.complexity == null) return null;

                let hash = crypto.createHash('md5').update(mapScoreQueryData.name.toLowerCase().trim()).digest("hex");
                let hnum = parseInt(hash.substring(0,8), 16);
                let gameUID = "procedural" + hnum + "-" + mapScoreQueryData.size + mapScoreQueryData.complexity;
                return `https://knucklecracker.com/${gameUrlParam}/scoreQuery.php?gameUID=${gameUID}&groupfilter=${groupName?groupName:""}`;
            default:
                return null;
        }
    }
}