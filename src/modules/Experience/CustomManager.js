'use strict';
/** @typedef {import('../../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

/** @typedef {import('../Experience.js').Db.experience_users} Db.experience_users */
/** @typedef {import('../Experience.js').Db.experience_maps_custom} Db.experience_maps_custom */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../../kc/KCLocaleManager.js';
import { KCUtil } from '../../kc/KCUtil.js';
import Experience from '../Experience.js';

/**
 * @typedef {object} NewMapsData
 * @property {number} countNewTotalCompleted
 * @property {number} countOldTotalCompleted
 * @property {KCGameMapManager.MapData[]} oldMapsTotalCompleted
 * @property {{finished: KCGameMapManager.MapData[], unfinished: KCGameMapManager.MapData[]}} oldSelectedMaps
 * @property {{finished: KCGameMapManager.MapData[], unfinished: KCGameMapManager.MapData[]}} newSelectedMaps
 */

/**
 * @typedef {object} ProfileData
 * @property {number} countTotalCompleted
 * @property {KCGameMapManager.MapData[]} mapsTotalCompleted
 * @property {KCGameMapManager.MapData[]} mapsTotalSelected
 * @property {{finished: KCGameMapManager.MapData[], unfinished: KCGameMapManager.MapData[]}} selectedMaps
 */

/**
 * @typedef {object} LeaderboardData
 * @property {number} countTotalCompleted
 * @property {KCGameMapManager.MapData[]} mapsTotalCompleted
 */

export class CustomManager {
    /**
     * 
     * @param {Experience} exp 
     */
    constructor(exp) {
        this.exp = exp;
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {KCGameMapManager} kcgmm
     * @param {Db.experience_users} resultUsers 
     * @param {KCGameMapManager.MapData[]} mapListArray
     * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId
     * @returns {Promise<NewMapsData>}
     */
    async newMaps(query, kcgmm, resultUsers, mapListArray, mapListId) {
        const mapListsForProcessing = {
            asArray: mapListArray, //mapListArrayModified
            byId: mapListId.clone() //mapListIdModified
        }
        //Get all custom maps of current user
        /** @type {Db.experience_maps_custom[]} */
        const resultsMapsCustom = (await query(`SELECT * FROM experience_maps_custom
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const oldMapsParsedFromDb = getMapsParsedFromDatabase(mapListId, resultsMapsCustom);
        const oldSelectedMaps = await getMapsCompleted(oldMapsParsedFromDb.selected, resultUsers.user_name, kcgmm);
        const allMapsCompleted = resultsMapsCustom.filter(v => v.state === 1).map(v => v.map_id).concat(oldSelectedMaps.finished.map(v => v.id));
        const countNewTotalCompleted = allMapsCompleted.length;

        /** @type {KCGameMapManager.MapData[]} */
        const selectedIds = [];
        selectRandomMaps(selectedIds, kcgmm.getHighestRankedMonthlyMaps(resultUsers.game, 4, 10, allMapsCompleted), allMapsCompleted, oldMapsParsedFromDb.ignored, 4);
        selectRandomMaps(selectedIds, mapListsForProcessing.asArray, allMapsCompleted, oldMapsParsedFromDb.ignored, 6);
        selectedIds.sort((a, b) => this.getExpFromMap(b, kcgmm, countNewTotalCompleted) - this.getExpFromMap(a, kcgmm, countNewTotalCompleted));

        await query(`DELETE FROM experience_maps_custom
            WHERE id_experience_users = '${resultUsers.id}' AND state = '0'`);

        for(let mapData of oldSelectedMaps.finished) {
            await query(`INSERT INTO experience_maps_custom (id_experience_users, map_id, state)
                VALUES ('${resultUsers.id}', '${mapData.id}', '1')`);
        }
        for(let mapData of selectedIds) {
            await query(`INSERT INTO experience_maps_custom (id_experience_users, map_id, state)
                VALUES ('${resultUsers.id}', '${mapData.id}', '0')`);
        }

        const newSelectedMaps = await getMapsCompleted(selectedIds, resultUsers.user_name, kcgmm);

        return {
            countNewTotalCompleted,
            countOldTotalCompleted: oldMapsParsedFromDb.completed.length,
            oldMapsTotalCompleted: oldMapsParsedFromDb.completed,
            oldSelectedMaps,
            newSelectedMaps
        }
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {KCGameMapManager} kcgmm
     * @param {Db.experience_users} resultUsers 
     * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId
     * @returns {Promise<ProfileData>}
     */
    async profile(query, kcgmm, resultUsers, mapListId) {
        //Get all custom maps of current user
        /** @type {Db.experience_maps_custom[]} */
        const resultsMapsCustom = (await query(`SELECT * FROM experience_maps_custom
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const mapsParsedFromDb = getMapsParsedFromDatabase(mapListId, resultsMapsCustom);
        const countTotalCompleted = mapsParsedFromDb.completed.length;
        const selectedMaps = await getMapsCompleted(mapsParsedFromDb.selected, resultUsers.user_name, kcgmm);


        return {
            countTotalCompleted, 
            mapsTotalCompleted: mapsParsedFromDb.completed,
            mapsTotalSelected: mapsParsedFromDb.selected,
            selectedMaps
        }
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {Db.experience_users} resultUsers
     * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId 
     * @returns {Promise<LeaderboardData>}
     */
    async leaderboard(query, resultUsers, mapListId) {
        //Get all custom maps of current user
        /** @type {Db.experience_maps_custom[]} */
        const resultsMapsCustom = (await query(`SELECT * FROM experience_maps_custom
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const mapsParsedFromDb = getMapsParsedFromDatabase(mapListId, resultsMapsCustom);
        const countTotalCompleted = mapsParsedFromDb.completed.length;

        return {
            countTotalCompleted,
            mapsTotalCompleted: mapsParsedFromDb.completed,
        }
    }

    /**
     * @param {KCGameMapManager.MapData} mapData 
     * @param {KCGameMapManager} kcgmm
     * @param {number} total - Total maps beaten
     * @returns {number}
     */
    getExpFromMap(mapData, kcgmm, total) {
        let value = 100;
        const rank = kcgmm.getMapMonthlyRank(mapData);

        if(mapData.timestamp != null && rank != null)
            value = Math.max(value, value + 200 - ((rank-1) * 20));
        
        return Math.ceil(value * this.exp.getExpMultiplier(total));
    }

    /**
     * 
     * @param {KCGameMapManager.MapData[]} maps 
     * @param {KCGameMapManager} kcgmm 
     * @param {number} total 
     * @returns {number}
     */
    getExpFromMaps(maps, kcgmm, total) {
        let xp = 0;
        for(let map of maps) {
            xp += this.getExpFromMap(map, kcgmm, total);
        }
        return xp;
    }

    /**
     * @param {KCGameMapManager.MapData} map 
     * @param {KCGameMapManager} kcgmm 
     * @param {number} total - Total maps completed
     * @param {boolean=} crossedOut - Whether the map should be crossed out
     * @returns {string}
     */
    getMapClaimString(map, kcgmm, total, crossedOut) {
        let cross = crossedOut ? '~~' : '';
        let str = `\`ID #${map.id}\`: ${this.exp.prettify(this.getExpFromMap(map, kcgmm, total))} XP - ${cross}${map.title} __by ${map.author}__${cross}`;

        if(map.timestamp == null) return str;
        let date = kcgmm.getDateFlooredToMonth(new Date(map.timestamp));
        let month = KCUtil.getMonthFromDate(date, true);
        const rank = kcgmm.getMapMonthlyRank(map);
        if(rank == null) return str;

        return `${str} (#${rank} ${month} ${date.getFullYear()})`;
    }
}

/**
 * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListByIds
 * @param {Db.experience_maps_custom[]} arr
 * @returns {{selected: KCGameMapManager.MapData[], completed: KCGameMapManager.MapData[], ignored: KCGameMapManager.MapData[]}}
 */
function getMapsParsedFromDatabase(mapListByIds, arr) {
    /** @type {{selected: KCGameMapManager.MapData[], completed: KCGameMapManager.MapData[], ignored: KCGameMapManager.MapData[]}} */
    const maps = {
        selected: [],
        completed: [],
        ignored: [],
    }
   
    for(let val of arr) {
        let map = mapListByIds.get(typeof val === 'number' ? val : val.map_id);
        //If map was deleted, ignore it
        if(map == null) continue;
        switch(val.state) {
        case 0: maps.selected.push(map); break;
        case 1: maps.completed.push(map); break;
        case 2: maps.ignored.push(map); break;
        }
    }
    return maps;
}

/**
 * 
 * @param {KCGameMapManager.MapData[]} maps
 * @param {string} userName
 * @param {KCGameMapManager} kcgmm
 * @returns {Promise<{finished: KCGameMapManager.MapData[], unfinished: KCGameMapManager.MapData[]}>} 
 */
async function getMapsCompleted(maps, userName, kcgmm) {
    /** @type {KCGameMapManager.MapData[]} */
    let finished = [];
    /** @type {KCGameMapManager.MapData[]} */
    let unfinished = [];

    let promises = [];
    for(let i = 0; i < maps.length; i++)
        promises[i] = kcgmm.getMapCompleted({game: maps[i].game, type: 'custom', id: maps[i].id}, userName, undefined, { removeMverseTag: true });
    for(let i = 0; i < promises.length; i++) {
        await promises[i] ? finished.push(maps[i]) : unfinished.push(maps[i]);
    }
    return {finished, unfinished};
}

/**
 * Select random custom maps that haven't been completed yet
 * @param {KCGameMapManager.MapData[]} arr - Array of maps to fill
 * @param {KCGameMapManager.MapData[]} maps - Maps to choose from. Will be mutated
 * @param {number[]} allMapsCompleted - Already finished maps
 * @param {KCGameMapManager.MapData[]} allMapsIgnored - Maps on ignore list
 * @param {number} count - Amount of maps to pick
 */
function selectRandomMaps(arr, maps, allMapsCompleted, allMapsIgnored, count) {
    //Random an index from the array.
    //Save the ID of the selected map then remove the element from the array to not roll duplicates.
    while(arr.length < count && maps.length > 0) {
        let index = Bot.Util.getRandomInt(0, maps.length);
        let map = maps[index];

        //Remove element from the array to indicate we have processed this map.
        maps.splice(index, 1);

        if(!isMapGoodToAdd(map, arr, allMapsCompleted, allMapsIgnored))
            continue;
        
        arr.push(map);
    }
}

/**
 * @param {KCGameMapManager.MapData|undefined} map
 * @param {KCGameMapManager.MapData[]} arr 
 * @param {number[]} allMapsCompleted 
 * @param {KCGameMapManager.MapData[]} allMapsIgnored 
 * @returns {boolean}
 */
function isMapGoodToAdd(map, arr, allMapsCompleted, allMapsIgnored) {
    //If the map no longer exists (for example it was deleted from the database) don't include it.
    if(!map)
        return false;
        
    //If we've already finished this map, don't include it.
    if(allMapsCompleted.find(v => v === map.id))
        return false;

    //If the map is on our ignore list, don't include it.
    if(allMapsIgnored.find(v => v.id === map.id))
        return false;

    //If we already added this map, don't include it.
    if(arr.indexOf(map) > -1)
        return false;
    return true;
}