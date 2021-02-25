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
        
        //These maps have to be plugged in as desired in selectCampaignMaps() 
        this.campaign = {
            cw4: [{
                name: "Farsite Expedition",
                maps: [
                    { name: '09 Leo, 266',              gameUID: 'c3Rvcnkw',            exp: 125 }, 
                    { name: 'Farsite',                  gameUID: 'c3Rvcnkx',            exp: 150 },
                    { name: 'Home',                     gameUID: 'c3Rvcnky',            exp: 175 },
                    { name: 'Not My Mars',              gameUID: 'c3Rvcnkz',            exp: 200 },
                    { name: 'Ruins Repurposed',         gameUID: 'c3Rvcnk0',            exp: 225 },
                    { name: 'We Know Nothing',          gameUID: 'c3Rvcnk1',            exp: 250 },
                    { name: 'We Were Never Alone',      gameUID: 'c3Rvcnk2',            exp: 275 },
                    { name: 'Hints',                    gameUID: 'c3Rvcnk3',            exp: 300 },
                    { name: 'Serious',                  gameUID: 'c3Rvcnk4',            exp: 325 },
                    { name: 'More and More',            gameUID: 'c3Rvcnk5',            exp: 350 },
                    { name: 'War and Peace',            gameUID: 'c3RvcnkxMA%3d%3d',    exp: 375 },
                    { name: 'Shattered',                gameUID: 'c3RvcnkxMQ%3d%3d',    exp: 400 },
                    { name: 'Archon',                   gameUID: 'c3RvcnkxMg%3d%3d',    exp: 425 },
                    { name: 'The Experiment',           gameUID: 'c3RvcnkxMw%3d%3d',    exp: 450 },
                    { name: 'Somewhere in Spacetime',   gameUID: 'c3RvcnkxNA%3d%3d',    exp: 475 },
                    { name: 'Tower of Darkness',        gameUID: 'c3RvcnkxNQ%3d%3d',    exp: 500 },
                    { name: 'The Compound',             gameUID: 'c3RvcnkxNg%3d%3d',    exp: 525 },
                    { name: 'Sequence',                 gameUID: 'c3RvcnkxNw%3d%3d',    exp: 550 },
                    { name: 'Wallis',                   gameUID: 'c3RvcnkxOA%3d%3d',    exp: 575 },
                    { name: 'Founders',                 gameUID: 'c3RvcnkxOQ%3d%3d',    exp: 600 },
                    { name: 'Ever After',               gameUID: 'c3RvcnkyMA%3d%3d',    exp: 1000 },
                ]
            }, {
                name: "Span Experiments",
                maps: [
                    { name: 'Special',                          gameUID: 'a251Y3JhY2tlcjEy',                exp: 250 },
                    { name: 'The Dark Side',                    gameUID: 'a251Y3JhY2tlcjE3',                exp: 250 },
                    { name: 'Turtle',                           gameUID: 'a251Y3JhY2tlcjU%3d',              exp: 250 },
                    { name: 'Cheap Construction',               gameUID: 'a251Y3JhY2tlcjg%3d',              exp: 250 },
                    { name: 'Four Pieces',                      gameUID: 'a251Y3JhY2tlcjI%3d',              exp: 250 },
                    { name: 'Highway to helheim',               gameUID: 'a251Y3JhY2tlcjEz',                exp: 250 },
                    { name: 'Holdem 2',                         gameUID: 'a251Y3JhY2tlcmJvbnVzMQ%3d%3d',    exp: 500 },
                    { name: 'Neuron',                           gameUID: 'a251Y3JhY2tlcjM%3d',              exp: 375 },
                    { name: 'Valley of the Shadow of Death',    gameUID: 'a251Y3JhY2tlcjY%3d',              exp: 250 },
                    { name: 'Sector L',                         gameUID: 'a251Y3JhY2tlcjk%3d',              exp: 250 },
                    { name: 'Far York Farm',                    gameUID: 'a251Y3JhY2tlcjE4',                exp: 375 },
                    { name: 'Invasion',                         gameUID: 'a251Y3JhY2tlcjIw',                exp: 250 },
                    { name: 'Forgotten Fortress',               gameUID: 'a251Y3JhY2tlcjE%3d',              exp: 250 },
                    { name: 'Mark V Sample',                    gameUID: 'ZGVtb2JvbnVz',                    exp: 300 },
                    { name: 'Gort',                             gameUID: 'a251Y3JhY2tlcjEw',                exp: 250 },
                    { name: 'Creeperpeace',                     gameUID: 'a251Y3JhY2tlcjE0',                exp: 250 },
                    { name: 'Creeper++',                        gameUID: 'a251Y3JhY2tlcjQ%3d',              exp: 250 },
                    { name: 'Before Time',                      gameUID: 'ZGVtb2JvbnVzMg%3d%3d',            exp: 300 },
                    { name: 'Islands',                          gameUID: 'a251Y3JhY2tlcjE1',                exp: 250 },
                    { name: 'Razor',                            gameUID: 'a251Y3JhY2tlcmJvbnVzMA%3d%3d',    exp: 375 },
                    { name: 'Day of Infamy',                    gameUID: 'ZGVtb2JvbnVzMw%3d%3d',            exp: 300 },
                    { name: 'Parasite',                         gameUID: 'a251Y3JhY2tlcjc%3d',              exp: 500 },
                    { name: 'Creepers Pieces',                  gameUID: 'a251Y3JhY2tlcjEx',                exp: 250 },
                    { name: 'Enchanted Forest',                 gameUID: 'a251Y3JhY2tlcjE2',                exp: 250 },
                    { name: 'Chanson',                          gameUID: 'a251Y3JhY2tlcjE5',                exp: 250 },
                    { name: 'Shaka',                            gameUID: 'ZGVtb2JvbnVzNA%3d%3d',            exp: 300 },

                ]
            }],
            pf: [],
            cw3: [],
            cw2: []
        }

        /** @type {Object.<string, Object.<string, {mapName: string, campaignName: string, exp: number}>>} */
        this.maps = {}; //game, then guid
        
        for(let keyval of Object.entries(this.campaign)) {
            for(let category of keyval[1]) {
                for(let map of category.maps) {
                    if(this.maps[keyval[0]] == null) this.maps[keyval[0]] = {};
                    this.maps[keyval[0]][map.gameUID] = {
                        mapName: map.name,
                        campaignName: category.name,
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
     * @returns {Promise<NewMapsData>}
     */
    async newMaps(query, kcgmm, resultUsers) {
        //Get all campaign maps of current user
        /** @type {Db.experience_maps_campaign[]} */
        const resultsMapsCampaign = (await query(`SELECT * FROM experience_maps_campaign
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        const oldMapsParsedFromDb = getMapsParsedFromDatabase.call(this, resultsMapsCampaign, resultUsers);
        const oldSelectedMaps = await getMapsCompleted(oldMapsParsedFromDb.selected, resultUsers.user_name, kcgmm);
        const allMapsCompleted = resultsMapsCampaign.filter(v => v.state === 1).map(v => v.game_uid).concat(oldSelectedMaps.finished.map(v => v.gameUID));

        /** @type {CampaignMapData[]} */
        let selectedCampaignMaps = [];
        selectCampaignMaps.call(this, selectedCampaignMaps, resultUsers, allMapsCompleted, oldMapsParsedFromDb.ignored);
        
        await query(`DELETE FROM experience_maps_campaign
            WHERE id_experience_users = '${resultUsers.id}' AND state = '0'`);

        for(let mapData of oldSelectedMaps.finished) {
            await query(`INSERT INTO experience_maps_campaign (id_experience_users, game_uid, state)
                         VALUES ('${resultUsers.id}', '${mapData.gameUID}', '1')`);
        }

        for(let mapData of selectedCampaignMaps) {
            await query(`INSERT INTO experience_maps_campaign (id_experience_users, game_uid, state)
                         VALUES ('${resultUsers.id}', '${mapData.gameUID}', '0')`);
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
     * @returns {string}
     */
    getMapClaimString(cmap, total) {
        let map = this.maps[cmap.game][cmap.gameUID];
        let str = `\`${map.campaignName}\`: ${this.getExpFromMap(cmap, total)} XP - ${map.mapName}`;
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
        promises[i] = kcgmm.getMapCompleted({game: maps[i].game, type: 'misc', gameUID: maps[i].gameUID}, userName);
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
    case 'cw4':
    case 'pf':
    case 'cw3':
    case 'cw2': {
        //Select ordered campaign(s)
        switch(user.game) {
        case 'cw4':
            campaigns.ordered.push(0);
            break;
        }
    
        //Select random campaign(s)
        switch(user.game) {
        case 'cw4':
            campaigns.random.push(1);
            break;
        }

        //Process ordered campaign(s)
        for(let index of campaigns.ordered) {
            let category = this.campaign[user.game][index];
            for(let cmap of category.maps) {
                if(!isMapGoodToAdd(cmap, arr, user, allMapsCompleted, allMapsIgnored))
                    continue;

                arr.push({
                    game: user.game,
                    gameUID: cmap.gameUID,
                    campaignName: category.name,
                    mapName: this.maps[user.game][cmap.gameUID].mapName
                });
                break;
            }
        }

        //Process random campaign(s)
        for(let index of campaigns.random) {
            let category = this.campaign[user.game][index];
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
                    campaignName: category.name,
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