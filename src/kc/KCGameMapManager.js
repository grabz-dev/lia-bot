"use strict";

/**
 * @typedef {object} KCGameMapManagerOptions
 * @property {number} cacheTimeCW2
 */

/**
 * @typedef {object} MapScoreQueryData
 * @property {string} game - cw2 cw3 pf cw4
 * @property {string} type - CW2: custom, code | CW3: custom, dmd | PF: custom | CW4: custom, chronom
 * @property {number=} id - Works for everything except CW2 code maps. Map ID number.
 * @property {string=} name - CW2 code map/CW4 markv map. The map seed
 * @property {number=} size - CW2 code map only. 0, 1, 2 - small, medium, large
 * @property {number=} complexity - CW2 code map only. 0, 1, 2 - low, medium, high
 * @property {number=} objective - CW4 only. Objective index 0-5
 * @property {number=} timestamp - CW4 only. Chronom date UTC timestamp.
 * @property {string=} gameUID - "misc" and type only. GUID of the map
 */

/**
 * @typedef {object} MapData
 * @property {string=} guid - GUID of the map. Excludes CW2
 * @property {number} id - The id of the map.
 * @property {string} game - cw2, cw3, pf, cw4
 * @property {string} author - The name of the author.
 * @property {string} title - The title of the map.
 * @property {number=} width - The width of the map.
 * @property {number=} height - The height of the map.
 * @property {number=} forumId - Forum thread ID.
 * @property {string=} desc - CW2, CW3 and PF only. The map description. 
 * @property {number=} downloads - CW2, CW3 and PF only. The amount of times the map was downloaded. 
 * @property {number=} scores - CW2, CW3 and PF only. The amount of scores submitted.
 * @property {number=} rating - PF and CW3 only. The rating of the map.
 * @property {number=} ratings - PF and CW3 only. The amount of ratings submitted.
 * @property {number=} upvotes - CW2 and CW4 only. The amount of times this map was rated up.
 * @property {number=} downvotes - CW2 only. The amount of times this map was rated down.
 * @property {string[]=} tags - CW4 only. The tags on this map.
 * @property {number=} objectives - CW4 only. Objectives available on this map, as a byte.
 * @property {number=} timestamp - CW3, PF, CW4 only. Map upload unix timestamp. CW2 check for undefined.
 * @property {number=} version - CW4 only
 * @property {string=} discordId - CW4 only for some maps. Discord thread ID
 */

/**
 * @typedef {object} MapBrowserData
 * @property {string} data - The original website source data string, cut off after the map that was last found.
 * @property {"cw1"|"cw2"} game
 * @property {MapData | null} mapData - The scraped map data, or null if no map was found. If null, should move to next page.
 */

/**
 * @typedef {object} MapLeaderboardEntry
 * @property {number} rank - The user's place on the leaderboard.
 * @property {string} user - The name of the user.
 * @property {number=} time - The time it took to finish the level, in frames.
 * @property {number=} score - CW2 and CW3 only. The user's score.
 * @property {number=} plays - CW2, CW3, PF only. The amount of times the user submitted a score.
 * @property {number=} eco - CW4 only. The eco value.
 * @property {number=} unitsBuilt - CW4 only. Total units built.
 * @property {number=} unitsLost - CW4 only. Total units lost.
 * @property {number=} mode - IXE only. 0 - normal. 1 - freebuild. 2 - slammer. 3 - freebuild+slammer
 */

/**
 * @typedef {object} MapLeaderboard
 * @property {(MapLeaderboardEntry[]|null)[]} entries - Single index array for CW2, CW3, PF. Index based on objective in CW4.
 */

/** @typedef {import('discord-bot-core/src/structures/Locale').Locale} Core.Locale */

import Discord from 'discord.js';
import crypto from 'crypto';
import xml2js from 'xml2js';
import fs from 'fs';
import { logger, Util } from 'discord-bot-core';
import { HttpRequest } from '../utils/HttpRequest.js';
import { gunzip } from '../utils/Zlib.js';
import { spawn } from 'child_process'
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { CW4NBTReader, TagCompound } from './CW4NBTReader.js';

import { fetchMapsDefault } from './KCGameMapManager/fetch-maps-default.js';
import { fetchMaps, readCache } from './KCGameMapManager/fetch-maps-cw2.js';
import { campaign } from '../kc/CampaignConfig.js';

const chronom_months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
"JULY", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * @class
 * @param {KCGameMapManagerOptions} options
 * @param {Core.Locale} locale
 */
export function KCGameMapManager(options, locale) {
    this._maps = Object.freeze({
        /** @type {Discord.Collection<string, Discord.Collection<number, Readonly<MapData>>>} */
        id: new Discord.Collection(),
        /** @type {Discord.Collection<string, ReadonlyArray<Readonly<MapData>>>} */
        array: new Discord.Collection(),
        /** @type {Discord.Collection<string, Object.<number, MapData[]>>} */
        month: new Discord.Collection(),
    });
    /** @type {{[id: string]: { timestamp: number }}} */
    this._cw2Maps = {};
    /** @type {{[id: string]: { title: string, rating: number, ratings: number, desc: string, forumId: number, timestamp: number }}} */
    this._cw1Maps = {};

    const minFetchInterval = 1000 * 60;
    /** @type {{[game: string]: number}} */
    let lastFetchTimestamp = {}

    /**
     * 
     * @param {{[id: string]: { timestamp: number }}} maps 
     */
    this.setCW2Maps = function(maps) {
        this._cw2Maps = maps;
    }
    /**
     * 
     * @param {{[id: string]: { title: string, rating: number, ratings: number, desc: string, timestamp: number }}} maps 
     */
    this.setCW1Maps = function(maps) {
        this._cw1Maps = maps;
    }

    /**
     * Get leaderboards for a map
     * @throws Error
     * @param {MapScoreQueryData} mapScoreQueryData -
     * @param {string=} userName
     * @param {string=} groupName
     * @param {{removeMverseTag?: boolean, ixeModes?: number[]}=} options
     * @returns {Promise<MapLeaderboard|null>} 
     */
    this.getMapScores = async function(mapScoreQueryData, userName, groupName, options) {
        if(mapScoreQueryData.game === 'cw1') {
            let entries = await getCW1Leaderboard(mapScoreQueryData, userName, groupName);
            return { entries: [entries] };
        }
        else {
            const url = getScoreQueryURL(mapScoreQueryData, userName, groupName);
            if(url == null)
                throw "Invalid score query data " + JSON.stringify(mapScoreQueryData);

            const game = mapScoreQueryData.game;

            let xml;
            let data;
            try {
                xml = await HttpRequest.get(url);
                data = await xml2js.parseStringPromise(xml);
            } catch(e) {
                logger.warn(`Could not get map scores. xml: ${(xml+'').replaceAll('\n','')}, data: ${data+''}`);
                return null;
            }

            if(game === 'cw4' || game === 'ixe') {
                /** @type {Array<MapLeaderboardEntry[]>} */
                let entries = [];
                for(let t in data.records) { //T0 T1 T2 T3 T4 T5
                    let i = +t.substring(1);
                    if(!(data.records[t][0].record instanceof Array))
                        continue;
                    entries[i] = getMapLeaderboardEntryFromRecord.call(this, game, data.records[t][0].record, mapScoreQueryData, options);
                    entries[i].sort((a, b) => {
                        return a.rank - b.rank;
                    });
                }

                if(mapScoreQueryData.game === 'ixe' && options?.ixeModes != null && entries[0] != null) {
                    for(let i = 0; i < entries[0].length; i++) {
                        let entry = entries[0][i];
                        if(entry.mode == null) continue;
                        if(!options.ixeModes.includes(entry.mode)) {
                            entries[0].splice(i, 1);
                            i--;
                        }
                    }

                    for(let i = 0; i < entries[0].length; i++) {
                        let entry = entries[0][i];
                        entry.rank = i+1;
                    }
                }



                return { entries: entries }
            }
            else {
                /** @type {MapLeaderboardEntry[]} */
                let entries = [];
                if(!(data.records.record instanceof Array))
                    return { entries: [entries] };
                entries = getMapLeaderboardEntryFromRecord.call(this, game, data.records.record, mapScoreQueryData, options);
                entries.sort((a, b) => {
                    return a.rank - b.rank;
                });
                return { entries: [entries] };
            }
        }
    }

    /**
     * @param {string} game
     * @param {string} str
     * @returns {string|null} 
     */
    this.resolveCampaignMapGUIDFromInputString = function(game, str) {
        let gameConfig = campaign[/** @type {'cw1'|'cw2'|'cw3'|'pf'|'cw4'|'ixe'} */(game)];
        let id = +str;
        //attempt to resolve by matching name
        if(!Number.isFinite(id) || id < 1) {
            for(let campaign of gameConfig) {
                for(let map of campaign.maps) {
                    if(map.name.replaceAll(' ', '').toLowerCase().includes(str.replaceAll(' ', '').toLowerCase())) {
                        return map.gameUID;
                    }
                }
            }
            return null;
        }
        //attempt to resolve by matching ID
        else {
            let campaignConfig = gameConfig.find(v => v.primary === true);
            //no primary campaigns detected, so we exit
            if(campaignConfig == null) return null;

            return campaignConfig.maps[id]?.gameUID??null;
        }
    }

    /**
     * @param {string} game
     * @param {string} guid
     * @returns {string|null} 
     */
    this.getCampaignMapNameFromGUID = function(game, guid) {
        let gameConfig = campaign[/** @type {'cw1'|'cw2'|'cw3'|'pf'|'cw4'|'ixe'} */(game)];
        for(let campaign of gameConfig) {
            for(let map of campaign.maps) {
                if(map.gameUID === guid) return map.name;
            }
        }
        return null;
    }

    /**
     * @param {string} game
     * @param {string} guid 
     * @returns 
     */
    this.getMapDescriptionFromMapDownload = async function(game, guid) {
        if (global.gc) {
            global.gc();
        }

        let gameUrlParam = KCLocaleManager.getUrlStringFromPrimaryAlias(game);
        let buffer = await (await HttpRequest.fetch(`https://knucklecracker.com/${gameUrlParam}/queryMaps.php?query=map&guid=${guid}`)).arrayBuffer();
        
        if(game === 'cw4') {
            let compressed = Array.from(new Uint8Array(buffer));
            compressed = compressed.slice(4);
            let data = await gunzip(new Uint8Array(compressed));
            let reader = new CW4NBTReader(data.buffer);
            let key = reader.readUint8();
            let val = reader.readString();
            let c = new TagCompound(reader, 'cw4');
            return ((c.dict.get("desc").value)+'').trim();
        }
        else if(game === 'ixe') {
            let metadataLength = Buffer.from(buffer).readUInt32LE(0);
            let lz4CompressedData = Uint8Array.prototype.slice.call(Buffer.from(buffer), 4, 4+metadataLength);
            let base64data = Buffer.from(lz4CompressedData).toString('base64')
            await LZ4Unpickle(base64data);
            let unpickled = fs.readFileSync('data.txt', 'utf8');
            fs.unlinkSync('data.txt');
            let b = atob(unpickled);
            let ab = new ArrayBuffer(b.length);
            let uint8Array = new Uint8Array(ab);
            for (let i = 0; i < b.length; i++) {
                uint8Array[i] = b.charCodeAt(i);
            }
            let reader = new CW4NBTReader(ab);
            let c = new TagCompound(reader, 'ixe');
            //replace VT characters with LF
            let desc = (Array.from(c.dict.values())[0].dict.get('e').value+'').trim().replace(/\x0B/g, '\x0A');
            return desc;
        }
    }

    /**
     * Check whether a user has an entry in the leaderboards for a map.
     * @throws Error
     * @param {MapScoreQueryData} mapScoreQueryData
     * @param {string=} name - The name of the user.
     * @param {string=} groupName - The group name.
     * @param {{removeMverseTag?: boolean, ixeModes?: number[]}=} options
     * @returns {Promise<boolean>}
     */
    this.getMapCompleted = async function(mapScoreQueryData, name, groupName, options) {
        let leaderboard = await this.getMapScores(mapScoreQueryData, name, groupName, options);
        if(leaderboard == null) return false;

        for(let scores of leaderboard.entries) {
            if(mapScoreQueryData.game === 'ixe' && options?.ixeModes != null) {
                for(let mode of options.ixeModes) {
                    if(scores && scores.find(entry => entry.user.toLowerCase() === name?.toLowerCase() && entry.mode === mode)) return true;
                }
            }
            else if(mapScoreQueryData.game === 'cw2') {
                if(scores && scores.find(entry => entry.user.toLowerCase() === name?.toLowerCase())) return true;
            }
            else {
                if(scores && scores.find(entry => entry.user === name)) return true;
            }
        }

        return false;
    }
    
    /**
     * Returns map list array sorted by ID's
     * The returned array is a slice, and can be modified
     * @param {string} game //cw2 cw3 pf cw4
     * @returns {Readonly<MapData>[] | null}
     */
    this.getMapListArray = function(game) {
        let mapList = this._maps.array.get(game);
        return mapList ? mapList.slice() : null;
    }

    /**
     * Returns map list collection mapped by ID's
     * The returned map is a clone, and can be modified
     * @param {string} game //cw2 cw3 pf cw4
     * @returns {Discord.Collection<number, Readonly<MapData>> | null} Collection mapped by map ID
     */
    this.getMapListId = function(game) {
        let mapList = this._maps.id.get(game);
        return mapList ? mapList.clone() : null;
    }

    /**
     * 
     * @param {string} game //cw2 cw3 pf cw4 
     * @param {number} id 
     * @returns {MapData|null}
     */
    this.getMapById = function(game, id) {
        let mapList = this._maps.id.get(game);
        if(mapList == null) return null;
        let map = mapList.get(id);
        if(map == null) return null;
        return Object.assign({}, map);
    }

    /**
     * Find map(s) by map title/author
     * null is returned if no matches are found
     * MapData is returned if a single match is found
     * MapData[] is returned if multiple matches are found
     * @param {string} game 
     * @param {string} title 
     * @param {string=} author
     * @returns {MapData|MapData[]|null}
     */
    this.getMapByTitle = function(game, title, author) {
        let mapArr = this._maps.array.get(game);
        if(mapArr == null) return null;

        title = title.toLowerCase().replaceAll(' ', '');
        if(author != null)
            author = author.toLowerCase().replaceAll(' ', '');
    
        /** @type { MapData[] } */
        const mapsFound = [];

        for(const map of mapArr) {
            const mapTitle = map.title.toLowerCase().replaceAll(' ', '');
            if(title === mapTitle) {
                if(author == null || map.author.toLowerCase().replaceAll(' ', '') === author)
                    mapsFound.push(Object.assign({}, map));
            }
        }

        if(mapsFound.length === 0) {
            for(const map of mapArr) {
                const mapTitle = map.title.toLowerCase().replaceAll(' ', '');
                if(mapTitle.indexOf(title) > -1) {
                    if(author == null || map.author.toLowerCase().replaceAll(' ', '') === author)
                        mapsFound.push(Object.assign({}, map))
                }
            }
        }

        if(mapsFound.length === 0) return null;
        if(mapsFound.length === 1) return mapsFound[0];
        return mapsFound;
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
        
        let monthly = this.getDateFlooredToMonth(new Date(timestamp)).getTime();

        if(mapList[monthly] == null) return [];
        return mapList[monthly].slice();
    }

    /**
     * Floor a date to its month. Does not modify original object.
     * e.g. Nov 14 2020 04:12:45 becomes Nov 01 2020 00:00:00
     * @param {Date} date
     * @returns {Date}
     */
    this.getDateFlooredToMonth = function(date) {
        date = new Date(date);
        date.setDate(1);
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    }

    /**
     * Get a map's monthly rank
     * @param {MapData} map 
     * @return {null|number}
     */
    this.getMapMonthlyRank = function(map) {
        if(map.timestamp == null) return null;
        const mapList = this._maps.month.get(map.game);
        if(mapList == null) return null;
        let monthly = this.getDateFlooredToMonth(new Date(map.timestamp)).getTime();
        const mapListMonthly = mapList[monthly];
        if(mapListMonthly == null) return null;
        let index = mapListMonthly.indexOf(map);
        if(index < 0) return null;
        return index + 1;
    }

    /**
     * Get an array of maps sorted based on their rank in their month
     * @param {string} game 
     * @param {number} count - Length of returned array
     * @param {number=} maxRank - The amount of maps after which to stop
     * @param {number[]=} exclude - Array of map IDs that will be excluded from the return array
     * @returns {MapData[]}
     */
    this.getHighestRankedMonthlyMaps = function(game, count, maxRank, exclude) {
        exclude = exclude ?? [];

        /** @type {MapData[][]} */
        const mapsByRank = []; //[rank][map]

        const mapList = this._maps.month.get(game);
        if(mapList == null) return [];
        /** @type {MapData[][]} */
        const mapListValues = Object.values(mapList);

        loop:
        for(let mapList of mapListValues) {
            for(let i = 0; i < mapList.length; i++) {
                const rank = i + 1;
                if(maxRank != null && rank > maxRank) continue loop;
                const map = mapList[i];
                if(mapsByRank[i] == null) mapsByRank[i] = [];

                if(!exclude.includes(map.id))
                    mapsByRank[i].push(map);
            }
        }

        /** @type {MapData[]} */
        const ret = [];

        loop:
        for(let maps of mapsByRank) {
            while(maps.length > 0) {
                const index = Util.getRandomInt(0, maps.length);
                const map = maps[index];
                maps.splice(index, 1);
                ret.push(map);
                if(ret.length >= count) break loop;
            }
        }
        
        return ret;
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
        if(lastFetchTimestamp[game] == null) lastFetchTimestamp[game] = 0;
        if(now - lastFetchTimestamp[game] < minFetchInterval) {
            throw `[KCGameMapManager.fetch] Must wait another ${(lastFetchTimestamp[game] + minFetchInterval - now) / 1000}s to fetch.`;
        }

        try {
            await fetchMapData.call(this, game);
            logger.info(`[KCGameMapManager.fetch] Fetched map data for ${game}.`);
            lastFetchTimestamp[game] = Date.now();
        }
        catch(err) {
            //@ts-ignore
            logger.warn(`[KCGameMapManager.fetch] Failed to fetch map data for ${game}. ${err} ${err.stack}`);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    this.readCacheCW2 = async function() {
        await readCache.call(this, options, 'cw2');
    }
    /**
     * @returns {Promise<void>}
     */
     this.readCacheCW1 = async function() {
        await readCache.call(this, options, 'cw1');
    }

    /**
     * 
     * @param {string} type 
     * @param {string|null} game 
     * @param {number|null} id 
     * @param {string|null} objective 
     * @param {string|null} seed 
     * @param {string|null} date 
     * @param {string|null} size 
     * @param {string|null} complexity 
     * @param {string|null} campaign 
     * @returns {{data: MapScoreQueryData, err: null}|{data: null, err: string}}
     */
    this.getMapQueryObjectFromCommandParameters = function(type, game, id, objective, seed, date, size, complexity, campaign) {
        /** @type {MapScoreQueryData|null} */
        let msqd = null;
        /** @type {{[id: string]: string}} */
        let errors = {};

        /** @type {number|null} */
        let objectiveNumber = null;
        if(type === 'cw4_chronom' || type === 'cw4_markv' || game === 'cw4') {
            if(objective != null) {
                objective = KCLocaleManager.getPrimaryAliasFromAlias("cw4_objectives", objective);
                if(objective == null) errors.objective = 'CW4 Objective is incorrect';
                else objectiveNumber = +objective;
            }
        }

        switch(type) {
        case 'campaign': {
            if(game == null || campaign == null || (game == 'cw4' && objectiveNumber == null)) {
                if(game == null) errors.game = 'Game missing';
                if(game == 'cw4' && objectiveNumber == null && errors.objective == null) errors.objective = 'CW4 Objective missing';
                if(campaign == null) errors.campaign = 'Campaign Name missing';
                break;
            }

            let guid = this.resolveCampaignMapGUIDFromInputString(/** @type {'cw1'|'cw2'|'cw3'|'pf'|'cw4'|'ixe'} */(game), campaign);
            if(guid == null) {
                errors.campaign = 'Campaign Name not resolved to any mission';
                break;
            }

            if(Object.keys(errors).length > 0) break;
            msqd = {
                game: game,
                type: 'misc',
                gameUID: guid,
                objective: objectiveNumber??undefined
            }
            break;
        }
        case 'custom': {
            if(game == null || id == null || (game == 'cw4' && objectiveNumber == null)) {
                if(game == null) errors.game = 'Game missing';
                if(id == null) errors.id = 'Map ID missing';
                if(game == 'cw4' && objectiveNumber == null && errors.objective == null) errors.objective = 'CW4 Objective missing';
                break;
            }

            if(Object.keys(errors).length > 0) break;
            msqd = {
                game: game,
                type: 'custom',
                id: id,
                objective: objectiveNumber??undefined
            }
            break;
        }
        case 'cw3_dmd': {
            if(id == null) {
                if(id == null) errors.id = 'Map ID missing';
                break;
            }

            if(Object.keys(errors).length > 0) break;
            msqd = {
                game: 'cw3',
                type: 'dmd',
                id: id
            }
            break;
        }
        case 'cw4_markv': {
            /** @type {string|null} */
            let validSeed = null;
            if(seed != null) {
                let arr = seed.split('#');
                if(arr.length <= 1) errors.seed = 'Mark V seed is missing parameters';
                else {
                    let name = arr.slice(0, arr.length - 1).join('#');
                    let params = arr[arr.length - 1];
                    if(params.length > 5 ||
                       !['1','2','3','4'].includes(params[0]) ||
                       !['1','2','3','4'].includes(params[1]) ||
                       !['1','2','3','4'].includes(params[2]) ||
                       !['1','2','3','4'].includes(params[3]) ||
                       (params[4] !== '$' && params[4] != null)) {
                            errors.seed = 'Mark V seed parameters are invalid';
                       }
                    else {
                        validSeed = seed;
                    }
                }
            }

            if(validSeed == null || objectiveNumber == null) {
                if(validSeed == null && errors.seed == null) errors.seed = 'Mark V seed is missing';
                if(objectiveNumber == null && errors.objective == null) errors.objective = 'CW4 Objective is missing'
                break;
            }

            if(Object.keys(errors).length > 0) break;
            msqd = {
                game: 'cw4',
                type: 'markv',
                name: validSeed,
                objective: objectiveNumber
            }
            break;
        }
        case 'cw4_chronom': {
            /** @type {number|null} */
            let dateTimestamp = null;
            if(date != null) {
                let _dateTimestamp = Date.parse(date);
                if(Number.isNaN(_dateTimestamp) || _dateTimestamp <= 0) errors.date = 'CW4 Chronom Date is incorrect';
                else dateTimestamp = _dateTimestamp;
            }

            if(dateTimestamp == null || objectiveNumber == null) {
                if(dateTimestamp == null && errors.date == null) errors.date = 'CW4 Chronom Date is missing';
                if(objectiveNumber == null && errors.objective == null) errors.objective = 'CW4 Objective is missing'
                break;
            }

            if(Object.keys(errors).length > 0) break;
            msqd = {
                game: 'cw4',
                type: 'chronom',
                timestamp: dateTimestamp,
                objective: objectiveNumber
            }
            break;
        }
        case 'cw2_code': {
            /** @type {number|null} */
            let sizeNumber = null;
            /** @type {number|null} */
            let complexityNumber = null;

            if(size != null) {
                size = KCLocaleManager.getPrimaryAliasFromAlias("cw2_code_map_size", size);
                if(size == null) errors.size = 'Code Map Size is incorrect';
                else {
                    let _sizeNumber = +size;
                    if(![0,1,2].includes(_sizeNumber)) errors.size = 'Code Map Size is incorrect';
                    else sizeNumber = _sizeNumber;
                }
            }
            if(complexity != null) {
                complexity = KCLocaleManager.getPrimaryAliasFromAlias("cw2_code_map_complexity", complexity);
                if(complexity == null) errors.complexity = 'Code Map Complexity is incorrect';
                else {
                    let _complexityNumber = +complexity;
                    if(![0,1,2].includes(_complexityNumber)) errors.complexity = 'Code Map Complexity is incorrect';
                    else complexityNumber = _complexityNumber;
                }
            }
            if(seed == null || sizeNumber == null || complexityNumber == null) {
                if(seed == null && errors.seed == null) errors.seed = 'Code Map Seed is missing';
                if(sizeNumber == null && errors.size == null) errors.size = 'Code Map Size is missing';
                if(complexityNumber == null && errors.complexity == null) errors.complexity = 'Code Map Complexity is missing';
                break;
            }

            if(Object.keys(errors).length > 0) break;
            msqd = {
                game: 'cw2',
                type: 'code',
                name: seed,
                size: sizeNumber,
                complexity: complexityNumber
            }
            break;
        }
        }

        if(msqd == null || Object.keys(errors).length > 0) {
            return { err: `The following parameters are missing from your query: ${Object.values(errors).join(', ')}`, data: null }
        }

        return { data: msqd, err: null };
    }

    /**
     * 
     * @param {number} b - CW4 objectives byte
     * @returns {Array<boolean>}
     */
    this.getCW4ObjectivesArray = function(b) {
        let arr = [];
        arr[5] = (b >> 5 & 1) != 0;
        arr[4] = (b >> 4 & 1) != 0;
        arr[3] = (b >> 3 & 1) != 0;
        arr[2] = (b >> 2 & 1) != 0;
        arr[1] = (b >> 1 & 1) != 0;
        arr[0] = (b >> 0 & 1) != 0;
        return arr;
    }

    /**
     * @this {KCGameMapManager}
     * @param {string} game
     * @param {MapData[]} arr 
     * @returns {Object.<number, MapData[]>}
     */
    this.getMonthObjFromMapData = function(game, arr) {
        /** @type {Object.<number, MapData[]>} */
        const month = {};

        for(let j = 0; j < arr.length; j++) {
            let map = arr[j];

            if(map.timestamp == null) continue;

            //Get month the map was uploaded in
            const date = this.getDateFlooredToMonth(new Date(map.timestamp));
            const time = date.getTime();
            if(month[time] == null) month[time] = [];
            month[time].push(map);
        }

        //Delete current month only
        delete month[+Object.keys(month).reduce((a, b) => +b > +a ? +b : +a, 0)];

        //Delete months with less than 10 maps
        for(let key of Object.keys(month)) {
            if(month[+key].length < 10) delete month[+key];
        }

        //Build map month
        for(let key of Object.keys(month)) {
            let maps = month[+key];

            switch(game) {
            case 'cw2':
                maps.sort((a, b) => (((b.upvotes??0) - (b.downvotes??0))||0) - (((a.upvotes??0) - (a.downvotes??0))||0));
                break;
            case 'cw1':
            case 'cw3':
            case 'pf':
                maps.sort((a, b) => (b.rating||0) - (a.rating||0));
                break;
            case 'cw4':
            case 'ixe':
                maps.sort((a, b) => (b.upvotes||0) - (a.upvotes||0));
                break;
            }
        }

        return month;
    }

    /**
     * Fetch map data.
     * @this {KCGameMapManager}
     * @param {string} game //cw1 cw2 cw3 pf cw4
     */
    async function fetchMapData(game) {
        if(game === 'cw1')
            await fetchMaps.call(this, options, 'cw1');
        else if(game === 'cw2')
            await fetchMaps.call(this, options, 'cw2');
        else
            await fetchMapsDefault.call(this, game);
    }

    /**
     * @this {KCGameMapManager}
     * @param {string} game
     * @param {any} record
     * @param {MapScoreQueryData} msqd
     * @param {{removeMverseTag?: boolean}=} options
     * @returns {MapLeaderboardEntry[]}
     */
    function getMapLeaderboardEntryFromRecord(game, record, msqd, options) {
        /** @type {MapLeaderboardEntry[]} */
        let arr = [];

        /** @type {null|number} */
        let lastTime = null;
        let rankOffset = 0;

        /** @type {Object.<string, true>} */
        const uniqueUsers = {};

        for(let entry of record) {
            let user = entry.user[0]+'';
            //Remove duplicate names
            if(uniqueUsers[user]) {
                rankOffset++;
                continue;
            }
            uniqueUsers[user] = true;

            let rank = +entry.rank[0];
            let time = entry.time == null ? undefined : +entry.time[0];
            let score = entry.score == null ? undefined : +entry.score[0];
            let plays = entry.plays == null ? undefined : +entry.plays[0];
            let eco = entry.eco == null ? undefined : +entry.eco[0];
            let unitsBuilt = entry.unitsBuilt == null ? undefined : +entry.unitsBuilt[0];
            let unitsLost = entry.unitsLost == null ? undefined : +entry.unitsLost[0];
            let mode = entry.mode == null ? undefined : +entry.mode[0];

            let timeorscore = time??score;
            if(timeorscore != null) { 
                //Handle ties
                if(lastTime != null && timeorscore === lastTime) {
                    rankOffset++;
                }
                rank -= rankOffset;
                lastTime = timeorscore;
            }

            if(game === 'cw4' && options?.removeMverseTag) {
                user = user.replace('[M] ', '');
            }

            if(game === 'cw4' && msqd.gameUID === this.resolveCampaignMapGUIDFromInputString("cw4", "Founders")) {
                if(user === 'cornucanis' && time === 1987 && eco === 0 && unitsBuilt === 12 && unitsLost === 6) continue;
                if(user === 'cornucanis' && time === 1992 && eco === 0 && unitsBuilt === 12 && unitsLost === 6) continue;
                if(user === 'cornucanis' && time === 2285 && eco === 0 && unitsBuilt === 16 && unitsLost === 6) continue;
                if(user === 'Fireswamp'  && time === 2511 && eco === 0 && unitsBuilt === 15 && unitsLost === 11) continue;
            }

            //Increase rank by 1 for PF leaderboards because they start at 0.
            if(game === "pf")
                rank++;

            /** @type {MapLeaderboardEntry} */
            arr.push({
                rank: rank,
                user: user,
                time: time,
                score: score,
                plays: plays,
                eco: eco,
                unitsBuilt: unitsBuilt,
                unitsLost: unitsLost,
                mode: mode,
            });
        }
        return arr;
    }

    /**
     * Get a ready to go URL for a map search query.
     * @param {MapScoreQueryData} msqd
     * @param {string=} userName
     * @param {string=} groupName
     * @returns {string | null} - The URL
     */
    function getScoreQueryURL(msqd, userName, groupName) {
        if(!msqd.game) return null;
        
        let gameUrlParam = KCLocaleManager.getUrlStringFromPrimaryAlias(msqd.game);

        switch(msqd.type) {
            case "custom":
                if(msqd.id == null) return null;
                return `https://knucklecracker.com/${gameUrlParam}/${msqd.game === 'cw4' || msqd.game === 'ixe' ? 'playLogQuery' : 'scoreQuery'}.php?customID=${msqd.id}&userfilter=${userName?userName:""}&groupfilter=${groupName?groupName:""}&sort=time`;
            case "dmd":
                if(msqd.id == null) return null;
                return `https://knucklecracker.com/${gameUrlParam}/scoreQuery.php?dmdID=${msqd.id}&userfilter=${userName?userName:""}&groupfilter=${groupName?groupName:""}&sort=time`;
            case "code": {
                if(msqd.name == null) return null;
                if(msqd.size == null) return null;
                if(msqd.complexity == null) return null;

                let hash = crypto.createHash('md5').update(msqd.name.toLowerCase().trim()).digest("hex");
                let hnum = parseInt(hash.substring(0,8), 16);
                let gameUID = "procedural" + hnum + "-" + msqd.size + msqd.complexity;
                return `https://knucklecracker.com/${gameUrlParam}/scoreQuery.php?gameUID=${gameUID}&userfilter=${userName?userName:""}&groupfilter=${groupName?groupName:""}&sort=time`;
            }
            case "chronom": {
                if(msqd.timestamp == null) return null;
                let date = new Date(msqd.timestamp);
                let str = `CHRONOM ${chronom_months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

                let encode = Buffer.from(str).toString('base64');
                return `https://knucklecracker.com/${gameUrlParam}/playLogQuery.php?gameUID=${encode}&userfilter=${userName?userName:""}&groupfilter=${groupName?groupName:""}&sort=time`;
            }
            case "markv": {
                if(msqd.name == null) return null;
                let name = msqd.name.toUpperCase();
                let encode = Buffer.from(name).toString('base64');

                return `https://knucklecracker.com/${gameUrlParam}/playLogQuery.php?gameUID=${encode}&userfilter=${userName?userName:""}&groupfilter=${groupName?groupName:""}&sort=time`;
            }
            case "misc": {
                return `https://knucklecracker.com/${gameUrlParam}/${msqd.game === 'cw4' || msqd.game === 'ixe' ? 'playLogQuery' : 'scoreQuery'}.php?gameUID=${msqd.gameUID}&userfilter=${userName?userName:""}&groupfilter=${groupName?groupName:""}&sort=time`;
            }
            default:
                return null;
        }
    }

    /**
     * Get a ready to go URL for a map search query.
     * @param {MapScoreQueryData} msqd
     * @param {string=} userName
     * @param {string=} groupName
     */
    async function getCW1Leaderboard(msqd, userName, groupName) {
        let isCampaign;
        let url;

        if(msqd.id != null) {
            isCampaign = false;
            url = `https://knucklecracker.com/creeperworld/mapcomments.php?id=${msqd.id}&userfilter=${userName??''}&groupfilter=${groupName??''}`;
        }
        else if(msqd.gameUID != null) {
            isCampaign = true;
            let split = msqd.gameUID.split('_')
            url = `https://knucklecracker.com/creeperworld/viewscores.php?mission=${split[1]}&missionGroup=${split[0]}&userfilter=${userName??''}&groupfilter=${groupName??''}`;
        }
        else {
            throw "Invalid score query data " + JSON.stringify(msqd);
        }

        let data = await HttpRequest.get(url);

        /** @type {{player: string, score: number, frames?: number, plays: number}[]} */
        let arrOfRaw = [];

        if(isCampaign) {
            data = data.substring(data.indexOf('All Time Score Leaderboard'), data.indexOf('Recent Score Leaderboard'));
        }

        while(true) {
            let search = `<tr class='scorerow`;
            let index = data.indexOf(search);
            if(index < 0) break;
            data = data.substring(index + search.length + 3);

            index = data.indexOf('nowrap>');
            if(index < 0) break;
            data = data.substring(index + 7);
            const player = data.substring(0, data.indexOf('<'));

            data = data.substring(data.indexOf('<td>') + 4);
            const score = +(data.substring(0, data.indexOf('<')));

            let frames;
            if(!isCampaign) {
                data = data.substring(data.indexOf('nowrap>') + 7);
                const time = data.substring(0, data.indexOf('<'));
                if(typeof time !== 'string') continue;
                let split = time.split('min');
                const min = +(split[0].trim())
                if(!Number.isFinite(min)) break;
                const sec = +(split[1].split('sec')[0].trim())
                if(!Number.isFinite(sec)) break;
                frames = (sec * 30) + (min * 60 * 30);
            }

            data = data.substring(data.indexOf('<td>') + 4);
            const plays = +(data.substring(0, data.indexOf('<')));

            if(typeof player !== 'string' || !Number.isFinite(score) || !Number.isFinite(plays)) continue;

            arrOfRaw.push({
                player, score, frames, plays
            })
        }

        arrOfRaw.sort((a, b) => (a.frames??a.score) - (b.frames??a.score));

        /** @type {MapLeaderboardEntry[]} */
        let arr = [];

        let rank = 0;
        /** @type {number|null} */
        let lastFrames = null;
        for(const score of arrOfRaw) {
            //handle ties
            if(lastFrames == null || (score.frames??score.score) !== lastFrames) {
                rank++;
                lastFrames = (score.frames??score.score);
            }

            /** @type {MapLeaderboardEntry} */
            arr.push({
                rank: rank,
                user: score.player,
                time: score.frames,
                score: score.score,
                plays: score.plays
            });
        }

        return arr;
    }
}

/**
 * @param {string} base64
 * @returns {Promise<void>}
 */
async function LZ4Unpickle(base64) {
    return new Promise((resolve, reject) => {
        let process = spawn('parse-ixe-description/parse_ixe_description', [base64]);

        //process.stdout.on('data', data => {
        //    resolve(data.toString());
        //});
        
        //process.stderr.on('data', (data) => {
        //    logger.error(`Error: ${data.toString()}`);
        //    reject();
        //});
        
        // Handle process exit
        process.on('close', (code) => {
            if (code === 0) {
                logger.info('parse_ixe_description ran successfully');
                resolve()
            } else {
                logger.error(`parse_ixe_description exited with code ${code}`);
                reject();
            }
        });

        setTimeout(reject, 3000)
    });
}