'use strict';
/** @typedef {import('../../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

/** @typedef {import('../Experience.js').Db.experience_users} Db.experience_users */
/** @typedef {import('../Experience.js').Db.experience_maps_campaign} Db.experience_maps_campaign */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../../kc/KCLocaleManager.js';
import { KCUtil } from '../../kc/KCUtil.js';
import Experience from '../Experience.js';
import { campaign } from '../../kc/CampaignConfig.js';

/**
 * @typedef {object} NewMapsData
 * @property {number} countNewTotalCompleted
 * @property {number} countOldTotalCompleted
 * @property {CampaignMapData[]} oldMapsTotalCompleted
 * @property {{finished: CampaignMapData[], unfinished: CampaignMapData[]}} oldSelectedMaps
 * @property {{finished: CampaignMapData[], unfinished: CampaignMapData[]}} newSelectedMaps
 */

/**
 * @typedef {object} ProfileData
 * @property {number} countTotalCompleted
 * @property {CampaignMapData[]} mapsTotalCompleted
 * @property {CampaignMapData[]} mapsTotalSelected
 * @property {{finished: CampaignMapData[], unfinished: CampaignMapData[]}} selectedMaps
 */

/**
 * @typedef {object} LeaderboardData
 * @property {number} countTotalCompleted
 * @property {CampaignMapData[]} mapsTotalCompleted
 */


/**
 * @typedef {object} CampaignMapData
 * @property {string} game
 * @property {string} mapName
 * @property {string} campaignName
 * @property {string} gameUID
 */

export class CampaignManager {
    /**
     * 
     * @param {Experience} exp 
     */
    constructor(exp) {
        this.exp = exp;

        /** @type {Object.<string, Object.<string, {mapName: string, campaignName: string, exp: number}>>} */
        this.maps = {}; //game, then guid
        
        for(let keyval of Object.entries(campaign)) {
            for(let category of keyval[1]) {
                for(let map of category.maps) {
                    if(this.maps[keyval[0]] == null) this.maps[keyval[0]] = {};
                    this.maps[keyval[0]][map.gameUID] = {
                        mapName: map.name,
                        campaignName: map.categoryOverride != null ? map.categoryOverride : category.name,
                        exp: map.exp
                    }
                }
            }
        }
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {KCGameMapManager} kcgmm
     * @param {Db.experience_users} resultUsers 
     * @param {number} timestamp
     * @returns {Promise<NewMapsData>}
     */
    async newMaps(query, kcgmm, resultUsers, timestamp) {
        //Get all campaign maps of current user
        /** @type {Db.experience_maps_campaign[]} */
        const resultsMapsCampaign = (await query(`SELECT * FROM experience_maps_campaign WHERE id_experience_users = ? FOR UPDATE`, [resultUsers.id])).results;

        const oldMapsParsedFromDb = getMapsParsedFromDatabase.call(this, resultsMapsCampaign, resultUsers);
        const oldSelectedMaps = await getMapsCompleted(oldMapsParsedFromDb.selected, resultUsers.user_name, kcgmm);
        const allMapsCompleted = resultsMapsCampaign.filter(v => v.state === 1).map(v => v.game_uid).concat(oldSelectedMaps.finished.map(v => v.gameUID));

        /** @type {CampaignMapData[]} */
        let selectedCampaignMaps = [];
        selectCampaignMaps.call(this, selectedCampaignMaps, resultUsers, allMapsCompleted, oldMapsParsedFromDb.ignored);

        await query(`UPDATE experience_maps_campaign SET state = 3 WHERE state = 0 AND id_experience_users = ?`, [resultUsers.id]);
        for(let mapData of oldSelectedMaps.finished) {
            /** @type {Db.experience_maps_campaign|null} */
            let existing = (await query(`SELECT * FROM experience_maps_campaign WHERE id_experience_users = ? AND game_uid = ?`, [resultUsers.id, mapData.gameUID])).results[0];

            if(existing) {
                await query(`UPDATE experience_maps_campaign SET state = ?, timestamp_claimed = ? WHERE id = ?`, [1, timestamp, existing.id]);
            }
            else {
                await query(`INSERT INTO experience_maps_campaign (id_experience_users, game_uid, state, timestamp_claimed)
                             VALUES (?, ?, ?, ?)`, [resultUsers.id, mapData.gameUID, 1, timestamp]);
            }
        }
        for(let mapData of selectedCampaignMaps) {
            /** @type {Db.experience_maps_campaign|null} */
            let existing = (await query(`SELECT * FROM experience_maps_campaign WHERE id_experience_users = ? AND game_uid = ?`, [resultUsers.id, mapData.gameUID])).results[0];

            if(existing) {
                await query(`UPDATE experience_maps_campaign SET state = ?, timestamp_claimed = ? WHERE id = ?`, [0, timestamp, existing.id]);
            }
            else {
                await query(`INSERT INTO experience_maps_campaign (id_experience_users, game_uid, state, timestamp_claimed)
                             VALUES (?, ?, ?, ?)`, [resultUsers.id, mapData.gameUID, 0, timestamp]);
            }
        }

        const newSelectedMaps = await getMapsCompleted(selectedCampaignMaps, resultUsers.user_name, kcgmm);

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
        /** @type {Db.experience_maps_campaign[]} */
        const resultsMapsCampaign = (await query(`SELECT * FROM experience_maps_campaign
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
        //Get all campaign maps of current user
        /** @type {Db.experience_maps_campaign[]} */
        const resultsMapsCampaign = (await query(`SELECT * FROM experience_maps_campaign
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const mapsParsedFromDb = getMapsParsedFromDatabase.call(this, resultsMapsCampaign, resultUsers);
        const countTotalCompleted = mapsParsedFromDb.completed.length;

        return {
            countTotalCompleted,
            mapsTotalCompleted: mapsParsedFromDb.completed,
        }
    }

     /**
     * @param {CampaignMapData} mapData 
     * @param {number} total - Total maps beaten
     * @returns {number}
     */
    getExpFromMap(mapData, total) {
        return Math.ceil(this.maps[mapData.game][mapData.gameUID].exp * this.exp.getExpMultiplier(total));
    }

    /**
     * 
     * @param {CampaignMapData[]} maps 
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
     * @param {CampaignMapData} cmap 
     * @param {number} total - Total maps completed
     * @param {boolean=} crossedOut - Whether the map should be crossed out
     * 
     * @returns {string}
     */
    getMapClaimString(cmap, total, crossedOut) {
        let cross = crossedOut ? '~~' : '';
        let map = this.maps[cmap.game][cmap.gameUID];
        let str = `\`${map.campaignName}\`: ${this.exp.prettify(this.getExpFromMap(cmap, total))} XP - ${cross}${map.mapName}${cross}`;
        return str;
    }
}

/**
 * @this {CampaignManager}
 * @param {Db.experience_maps_campaign[]} arr
 * @param {Db.experience_users} user
 * @returns {{selected: CampaignMapData[], completed: CampaignMapData[], ignored: CampaignMapData[]}}
 */
function getMapsParsedFromDatabase(arr, user) {
    /** @type {{selected: CampaignMapData[], completed: CampaignMapData[], ignored: CampaignMapData[]}} */
    const maps = {
        selected: [],
        completed: [],
        ignored: [],
    }
   
    for(let map of arr) {
        let m = {
            game: user.game,
            mapName: this.maps[user.game][map.game_uid].mapName,
            campaignName: this.maps[user.game][map.game_uid].campaignName,
            gameUID: map.game_uid
        }

        switch(map.state) {
        case 0: maps.selected.push(m); break;
        case 1: maps.completed.push(m); break;
        case 2: maps.ignored.push(m); break;
        }
    }
    return maps;
}

/**
 * 
 * @param {CampaignMapData[]} maps
 * @param {string} userName
 * @param {KCGameMapManager} kcgmm
 * @returns {Promise<{finished: CampaignMapData[], unfinished: CampaignMapData[]}>} 
 */
async function getMapsCompleted(maps, userName, kcgmm) {
    /** @type {CampaignMapData[]} */
    let finished = [];
    /** @type {CampaignMapData[]} */
    let unfinished = [];

    let promises = [];
    for(let i = 0; i < maps.length; i++)
        promises[i] = kcgmm.getMapCompleted({game: maps[i].game, type: 'misc', gameUID: maps[i].gameUID}, userName, undefined, { removeMverseTag: true });
    for(let i = 0; i < promises.length; i++) {
        await promises[i] ? finished.push(maps[i]) : unfinished.push(maps[i]);
    }
    return {finished, unfinished};
}

/**
 * Select random campaign maps that haven't been completed yet
 * @this {CampaignManager}
 * @param {CampaignMapData[]} arr 
 * @param {Db.experience_users} user
 * @param {string[]} allMapsCompleted - Already finished maps
 * @param {CampaignMapData[]} allMapsIgnored - Maps on ignore list
 */
function selectCampaignMaps(arr, user, allMapsCompleted, allMapsIgnored) {
    const campaigns = {
        /** @type {number[]} */
        ordered: [],
        /** @type {number[]} */
        random: [],
    }

    switch(user.game) {
    case 'ixe':
    case 'cw4':
    case 'pf':
    case 'cw3':
    case 'cw2':
    case 'cw1': {
        //Select campaign(s) for each game
        switch(user.game) {
        case 'ixe':
            campaigns.ordered.push(0);
            campaigns.ordered.push(1);
            campaigns.ordered.push(2);
            break;
        case 'cw4':
            campaigns.ordered.push(0);
            campaigns.random.push(1);
            break;
        case 'pf':
            campaigns.ordered.push(0);
            campaigns.ordered.push(1);
            break;
        case 'cw3':
            campaigns.ordered.push(0);
            break;
        case 'cw2':
            campaigns.ordered.push(0);
            campaigns.ordered.push(1);
            break;
        case 'cw1':
            campaigns.ordered.push(0);
            campaigns.ordered.push(1);
            break;
        }

        //Process ordered campaign(s)
        for(let index of campaigns.ordered) {
            let category = campaign[user.game][index];
            let i = 0;
            for(let cmap of category.maps) {
                if(!isMapGoodToAdd(cmap, arr, user, allMapsCompleted, allMapsIgnored))
                    continue;

                arr.push({
                    game: user.game,
                    gameUID: cmap.gameUID,
                    campaignName: cmap.categoryOverride != null ? cmap.categoryOverride : category.name,
                    mapName: this.maps[user.game][cmap.gameUID].mapName
                });
                i++;
                if(i >= category.atOnce) break;
            }
        }

        //Process random campaign(s)
        for(let index of campaigns.random) {
            let category = campaign[user.game][index];
            let random = category.maps.slice();
            while(random.length > 0) {
                let index = Bot.Util.getRandomInt(0, random.length);
                let cmap = random[index];
                random.splice(index, 1);
                
                if(!isMapGoodToAdd(cmap, arr, user, allMapsCompleted, allMapsIgnored))
                    continue;

                arr.push({
                    game: user.game,
                    gameUID: cmap.gameUID,
                    campaignName: cmap.categoryOverride != null ? cmap.categoryOverride : category.name,
                    mapName: this.maps[user.game][cmap.gameUID].mapName
                });
                break;
            }
        }

        break;
    }
    }
}

/**
 * 
 * @param {{name: string, gameUID: string, exp: number}} cmap 
 * @param {CampaignMapData[]} arr 
 * @param {Db.experience_users} user
 * @param {string[]} allMapsCompleted 
 * @param {CampaignMapData[]} allMapsIgnored 
 * @returns {boolean}
 */
function isMapGoodToAdd(cmap, arr, user, allMapsCompleted, allMapsIgnored) {
    //If we've already finished this map, don't include it.
    if(allMapsCompleted.find(v => v === cmap.gameUID))
        return false;
    
    //If the map is on our ignore list, don't include it.
    if(allMapsIgnored.find(v => v.gameUID === cmap.gameUID))
        return false;

    //If we already added this map, don't include it.
    if(arr.find(v => v.game === user.game && v.gameUID === cmap.gameUID))
        return false;
    return true;
}