'use strict';
/** @typedef {import('../../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

/** @typedef {import('../Experience.js').Db.experience_users} Db.experience_users */
/** @typedef {import('../Experience.js').Db.experience_maps_markv} Db.experience_maps_markv */

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
 * @property {MarkVMapData[]} oldMapsTotalCompleted
 * @property {{finished: MarkVMapData[], unfinished: MarkVMapData[]}} oldSelectedMaps
 * @property {{finished: MarkVMapData[], unfinished: MarkVMapData[]}} newSelectedMaps
 */

/**
 * @typedef {object} ProfileData
 * @property {number} countTotalCompleted
 * @property {MarkVMapData[]} mapsTotalCompleted
 * @property {MarkVMapData[]} mapsTotalSelected
 * @property {{finished: MarkVMapData[], unfinished: MarkVMapData[]}} selectedMaps
 */

/**
 * @typedef {object} LeaderboardData
 * @property {number} countTotalCompleted
 * @property {MarkVMapData[]} mapsTotalCompleted
 */


/**
 * @typedef {string} MarkVMapData
 */


export class MarkVManager {
    /**
     * 
     * @param {Experience} exp 
     */
    constructor(exp) {
        this.exp = exp;
        
        this.seeds = [
            'after october three#1222',
            'knucklecracker#2222',
            'knucracker ring it#2223',
            'after october three#1333',
            'door cake away#2222',
            'xol#2211',
            'game round up#2333',
            'round by little#2333',
            'knucracker ring it#2424',
            'door window funny#2333',
            'seven or eleven#1333',
            'prayse the sun#2222',
            '#2222',
            'iron maiden#1333',
            'the roadcrew#1333',
            'killed by death#2333',
            'yee haw#4413',
            'black leather jacket#1333',
            'heart of stone#1343',
            'itsy bitsy spider#4444',
            'kami and danu forever#3321',
            'think up one#4444',
            'ho oh#1333',
            'rampardos#1334',
            'bulbasaur#1434',
            'slaking#1434',
            'bilbo#1414',
            'rohan#4424',
            'eriador#3414$',
            'the hunt for red october#1444',
            'growing trees#1414',
            'katze#1414',
            'garden#1414',
            'where sun time #2444',
            'startup#2444',
            'alien#1414'
        ]

        /** @type {Object.<string, true>} */
        this.maps = {};

        for(let val of this.seeds) {
            this.maps[val] = true;
        }
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {KCGameMapManager} kcgmm
     * @param {Db.experience_users} resultUsers 
     * @returns {Promise<NewMapsData>}
     */
    async newMaps(query, kcgmm, resultUsers) {
        //Get all campaign maps of current user
        /** @type {Db.experience_maps_markv[]} */
        const resultsMapsMarkV = (await query(`SELECT * FROM experience_maps_markv
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const oldMapsParsedFromDb = getMapsParsedFromDatabase.call(this, resultsMapsMarkV, resultUsers);
        const oldSelectedMaps = await getMapsCompleted(oldMapsParsedFromDb.selected, resultUsers.user_name, kcgmm);
        const allMapsCompleted = resultsMapsMarkV.filter(v => v.state === 1).map(v => v.seed).concat(oldSelectedMaps.finished);

        /** @type {MarkVMapData[]} */
        let selectedMarkVMaps = [];
        selectMarkVMaps.call(this, selectedMarkVMaps, resultUsers, allMapsCompleted, oldMapsParsedFromDb.ignored);
        selectMarkVMaps.call(this, selectedMarkVMaps, resultUsers, allMapsCompleted, oldMapsParsedFromDb.ignored);
        
        await query(`DELETE FROM experience_maps_markv
            WHERE id_experience_users = '${resultUsers.id}' AND state = '0'`);

        for(let mapData of oldSelectedMaps.finished) {
            await query(`INSERT INTO experience_maps_markv (id_experience_users, seed, state)
                         VALUES ('${resultUsers.id}', '${mapData}', '1')`);
        }

        for(let mapData of selectedMarkVMaps) {
            await query(`INSERT INTO experience_maps_markv (id_experience_users, seed, state)
                         VALUES ('${resultUsers.id}', '${mapData}', '0')`);
        }

        const newSelectedMaps = await getMapsCompleted(selectedMarkVMaps, resultUsers.user_name, kcgmm);

        return {
            countNewTotalCompleted: allMapsCompleted.length,
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
     * @returns {Promise<ProfileData>}
     */
    async profile(query, kcgmm, resultUsers) {
        //Get all campaign maps of current user
        /** @type {Db.experience_maps_markv[]} */
        const resultsMapsCampaign = (await query(`SELECT * FROM experience_maps_markv
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const mapsParsedFromDb = getMapsParsedFromDatabase.call(this, resultsMapsCampaign, resultUsers);
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
     * @returns {Promise<LeaderboardData>}
     */
    async leaderboard(query, resultUsers) {
        /** @type {Db.experience_maps_markv[]} */
        const resultsMapsMarkV = (await query(`SELECT * FROM experience_maps_markv
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const mapsParsedFromDb = getMapsParsedFromDatabase.call(this, resultsMapsMarkV, resultUsers);
        const countTotalCompleted = mapsParsedFromDb.completed.length;

        return {
            countTotalCompleted,
            mapsTotalCompleted: mapsParsedFromDb.completed,
        }
    }

     /**
     * @param {MarkVMapData} seed 
     * @param {number} total - Total maps beaten
     * @returns {number}
     */
    getExpFromMap(seed, total) {
        const parameters = seed.split('#')[1].replace('$','');
        let exp = 0;

        for(let i = 0; i < 4; i++) {
            exp += +parameters[i] * 25;
        }

        return Math.ceil(exp * this.exp.getExpMultiplier(total));
    }

    /**
     * 
     * @param {MarkVMapData[]} maps 
     * @param {number} total 
     * @returns {number}
     */
    getExpFromMaps(maps, total) {
        let xp = 0;
        for(let map of maps) {
            xp += this.getExpFromMap(map, total);
        }
        return xp;
    }

    /**
     * @param {MarkVMapData} cmap 
     * @param {number} total - Total maps completed
     * @param {boolean=} crossedOut - Whether the map should be crossed out
     * 
     * @returns {string}
     */
    getMapClaimString(cmap, total, crossedOut) {
        let cross = crossedOut ? '~~' : '';
        let str = `\`Mark V\`: ${this.exp.prettify(this.getExpFromMap(cmap, total))} XP - ${cross}${cmap}${cross}`;
        return str;
    }
}

/**
 * @this {MarkVManager}
 * @param {Db.experience_maps_markv[]} arr
 * @param {Db.experience_users} user
 * @returns {{selected: MarkVMapData[], completed: MarkVMapData[], ignored: MarkVMapData[]}}
 */
function getMapsParsedFromDatabase(arr, user) {
    /** @type {{selected: MarkVMapData[], completed: MarkVMapData[], ignored: MarkVMapData[]}} */
    const maps = {
        selected: [],
        completed: [],
        ignored: [],
    }

    for(let map of arr) {
        //in case a seed is deleted
        if(!this.maps[map.seed]) continue;

        switch(map.state) {
        case 0: maps.selected.push(map.seed); break;
        case 1: maps.completed.push(map.seed); break;
        case 2: maps.ignored.push(map.seed); break;
        }
    }
    return maps;
}

/**
 * 
 * @param {MarkVMapData[]} maps
 * @param {string} userName
 * @param {KCGameMapManager} kcgmm
 * @returns {Promise<{finished: MarkVMapData[], unfinished: MarkVMapData[]}>} 
 */
async function getMapsCompleted(maps, userName, kcgmm) {
    /** @type {MarkVMapData[]} */
    let finished = [];
    /** @type {MarkVMapData[]} */
    let unfinished = [];

    console.log(maps);

    let promises = [];
    for(let i = 0; i < maps.length; i++)
        promises[i] = kcgmm.getMapCompleted({game: 'cw4', type: 'markv', name: maps[i]}, userName, undefined, { removeMverseTag: true });
    for(let i = 0; i < promises.length; i++) {
        await promises[i] ? finished.push(maps[i]) : unfinished.push(maps[i]);
    }

    return {finished, unfinished};
}

/**
 * Select random markV maps that haven't been completed yet
 * @this {MarkVManager}
 * @param {MarkVMapData[]} arr 
 * @param {Db.experience_users} user
 * @param {string[]} allMapsCompleted - Already finished maps
 * @param {MarkVMapData[]} allMapsIgnored - Maps on ignore list
 */
function selectMarkVMaps(arr, user, allMapsCompleted, allMapsIgnored) {
    if(user.game !== 'cw4') return;

    let random = this.seeds.slice();
    while(random.length > 0) {
        let index = Bot.Util.getRandomInt(0, random.length);
        let cmap = random[index];
        random.splice(index, 1);
        
        if(!isMapGoodToAdd(cmap, arr, user, allMapsCompleted, allMapsIgnored))
            continue;

        arr.push(cmap);
        break;
    }
}

/**
 * 
 * @param {MarkVMapData} cmap 
 * @param {MarkVMapData[]} arr 
 * @param {Db.experience_users} user
 * @param {string[]} allMapsCompleted 
 * @param {MarkVMapData[]} allMapsIgnored 
 * @returns {boolean}
 */
function isMapGoodToAdd(cmap, arr, user, allMapsCompleted, allMapsIgnored) {
    //If we've already finished this map, don't include it.
    if(allMapsCompleted.find(v => v === cmap))
        return false;
    
    //If the map is on our ignore list, don't include it.
    if(allMapsIgnored.find(v => v === cmap))
        return false;

    //If we already added this map, don't include it.
    if(arr.find(v => v === cmap))
        return false;
    return true;
}