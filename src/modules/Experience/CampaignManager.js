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

/**
 * @typedef {object} CampaignMapDefinition
 * @property {string} name
 * @property {string} gameUID
 * @property {number} exp
 * @property {string=} categoryOverride
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
                name: 'Farsite Expedition',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
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
                name: 'Span Experiments',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
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
            pf: [{
                name: 'Story',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
                maps: [
                    { name: 'Naivety',          gameUID: '1Story',                 exp: 250 },
                    { name: 'Indelible',        gameUID: '2Story',                 exp: 275 },
                    { name: 'Unwise',           gameUID: '3Story',                 exp: 300 },
                    { name: 'Insanity',         gameUID: '4Story',                 exp: 325 },
                    { name: 'Evidence',         gameUID: '5Story',                 exp: 350 },
                    { name: 'Stretch',          gameUID: '6Story',                 exp: 375 },
                    { name: 'Brute',            gameUID: '7Story',                 exp: 400 },
                    { name: 'Potential',        gameUID: '8Story',                 exp: 425 },
                    { name: 'Emergent',         gameUID: '9Story',                 exp: 450 },
                    { name: 'Ties',             gameUID: '10Story',                exp: 475 },
                    { name: 'Secrets',          gameUID: '11Story',                exp: 500 },
                    { name: 'Doppelgangers',    gameUID: '12Story',                exp: 525 },
                    { name: 'Intent',           gameUID: '13Story',                exp: 550 },
                    { name: 'The 145th',        gameUID: '14Story',                exp: 575 },
                    { name: 'Origin',           gameUID: '15Story',                exp: 600 },
                ]
            }, {
                name: 'Inception',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
                maps: [
                    { name: 'The Melt',                 gameUID: '1Inception',                 exp: 260 },
                    { name: 'Fountains of Betelgeuse',  gameUID: '2Inception',                 exp: 270 },
                    { name: 'Daisy Chain',              gameUID: '3Inception',                 exp: 280 },
                    { name: 'Industrial Complex',       gameUID: '4Inception',                 exp: 290 },
                    { name: 'Square Land',              gameUID: '5Inception',                 exp: 300 },
                    { name: 'CEO\'s Landing',           gameUID: '6Inception',                 exp: 310 },
                    { name: 'Archipelago',              gameUID: '7Inception',                 exp: 320 },
                    { name: 'The Nest',                 gameUID: '8Inception',                 exp: 330 },
                    { name: 'Warp Never Changes',       gameUID: '9Inception',                 exp: 340 },
                ]
            }],
            cw3: [{
                name: 'Arc Eternal',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
                maps: [
                    { name: 'Inceptus : Tempus',        gameUID: 'Tempus',              exp: 125 },
                    { name: 'Inceptus : Carcere',       gameUID: 'Carcere',             exp: 150 },
                    { name: 'Abitus : Telos',           gameUID: 'Telos',               exp: 175 },
                    { name: 'Abitus : Far York',        gameUID: 'Far+York',            exp: 200 },
                    { name: 'Abitus : Starsync',        gameUID: 'Starsync',            exp: 225 },
                    { name: 'Navox : Jojo',             gameUID: 'Jojo',                exp: 250 },
                    { name: 'Navox : Ormos',            gameUID: 'Ormos',               exp: 275 },
                    { name: 'Navox : Seedet',           gameUID: 'Seedet',              exp: 300 },
                    { name: 'Navox : Flick',            gameUID: 'Flick',               exp: 325 },
                    { name: 'Navox : Tiplex',           gameUID: 'Tiplex',              exp: 350 },
                    { name: 'Egos : Lemal',             gameUID: 'Lemal',               exp: 375 },
                    { name: 'Egos : Ruine',             gameUID: 'Ruine',               exp: 400 },
                    { name: 'Egos : Defi',              gameUID: 'Defi',                exp: 425 },
                    { name: 'Egos : Choix',             gameUID: 'Choix',               exp: 450 },
                    { name: 'Egos : Chanson',           gameUID: 'Chanson',             exp: 475 },
                    { name: 'Frykt : Mistet',           gameUID: 'Mistet',              exp: 500 },
                    { name: 'Frykt : Crosslaw',         gameUID: 'Crosslaw',            exp: 525 },
                    { name: 'Frykt : Vapen',            gameUID: 'Vapen',               exp: 550 },
                    { name: 'Apex : Meso',              gameUID: 'Meso',                exp: 575 },
                    { name: 'Cliff : Krig',             gameUID: 'Krig',                exp: 600 },
                    { name: 'Andere : Otrav',           gameUID: 'Otrav',               exp: 625 },
                    { name: 'Andere : Farbor',          gameUID: 'Farbor',              exp: 650 },
                    { name: 'Cricket : Arca',           gameUID: 'Arca',                exp: 675 },
                    { name: 'Adventure : Fortress of Ultimate Darkness', gameUID: 'credits', exp: 1000, categoryOverride: 'Credits' },
                ]
            }],
            cw2: [{
                name: 'Story',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
                maps: [
                    { name: 'Day 1: Novus Orsa',        gameUID: 's0',              exp: 125 },
                    { name: 'Day 2: Far York',          gameUID: 's1',              exp: 150 },
                    { name: 'Day 3: Taurus',            gameUID: 's2',              exp: 175 },
                    { name: 'Day 4: UC-1004',           gameUID: 's3',              exp: 200 },
                    { name: 'Day 5: The Maxia Choice',  gameUID: 's4',              exp: 225 },
                    { name: 'Day 6: Chaos',             gameUID: 's5',              exp: 250 },
                    { name: 'Day 7: Lost',              gameUID: 's6',              exp: 275 },
                    { name: 'Day 8: Sliver',            gameUID: 's7',              exp: 300 },
                    { name: 'Day 9: Intelligence',      gameUID: 's8',              exp: 325 },
                    { name: 'Day 10: The Experiment',   gameUID: 's9',              exp: 350 },
                    { name: 'Day 11: The Cooker',       gameUID: 's10',             exp: 375 },
                    { name: 'Day 12: Answer',           gameUID: 's11',             exp: 400 },
                    { name: 'Day 13: Horror',           gameUID: 's12',             exp: 425 },
                    { name: 'Day 14: Phoenix',          gameUID: 's13',             exp: 450 },
                    { name: 'Day 15: Exterminate!',     gameUID: 's14',             exp: 475 },
                    { name: 'Day 16: Purpose',          gameUID: 's15',             exp: 500 },
                    { name: 'Day 17: Trickery',         gameUID: 's16',             exp: 525 },
                    { name: 'Day 18: The Tide',         gameUID: 's17',             exp: 550 },
                    { name: 'Day 19: Colony Prime',     gameUID: 's18',             exp: 575 },
                    { name: 'Day 20: All Things',       gameUID: 's19',             exp: 600 },
                    { name: 'Credits', gameUID: 'credits', exp: 1000, categoryOverride: 'Credits' },
                ]
            }, {
                name: 'Bonus',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
                maps: [
                    { name: 'Positronic',       gameUID: 'b0',              exp: 260 },
                    { name: 'The Tree',         gameUID: 'b1',              exp: 270 },
                    { name: 'Minion Surprise',  gameUID: 'b2',              exp: 280 },
                    { name: 'Shields Up!',      gameUID: 'b3',              exp: 290 },
                    { name: 'Stygian Depths',   gameUID: 'b4',              exp: 300 },
                    { name: 'Odyssey',          gameUID: 'b5',              exp: 310 },
                    { name: 'Barbarian Hordes', gameUID: 'b6',              exp: 320 },
                    { name: 'Assault',          gameUID: 'b7',              exp: 330 },
                    { name: 'Cubic',            gameUID: 'b8',              exp: 340 },
                    { name: 'Abyss',            gameUID: 'b9',              exp: 350 },
                ]
            }],
            cw1: [{
                name: 'Story',
                atOnce: 1,
                /** @type {CampaignMapDefinition[]} */
                maps: [
                    { name: 'Hope',        gameUID: "story_0",              exp: 125 },
                    { name: 'Taurus',      gameUID: "story_1",              exp: 150 },
                    { name: 'Fitch',       gameUID: "story_2",              exp: 175 },
                    { name: 'Orion',       gameUID: "story_3",              exp: 200 },
                    { name: 'Cetus',       gameUID: "story_4",              exp: 225 },
                    { name: 'Ara',         gameUID: "story_5",              exp: 250 },
                    { name: 'Corvus',      gameUID: "story_6",              exp: 275 },
                    { name: 'Draco',       gameUID: "story_7",              exp: 300 },
                    { name: 'Crux',        gameUID: "story_8",              exp: 325 },
                    { name: 'Octan',       gameUID: "story_9",              exp: 350 },
                    { name: 'Tucana',      gameUID: "story_10",              exp: 375 },
                    { name: 'Vela',        gameUID: "story_11",              exp: 400 },
                    { name: 'Pavo',        gameUID: "story_12",              exp: 425 },
                    { name: 'Ursa',        gameUID: "story_13",              exp: 450 },
                    { name: 'Canis',       gameUID: "story_14",              exp: 475 },
                    { name: 'Ix',          gameUID: "story_15",              exp: 500 },
                    { name: 'Scluptor',    gameUID: "story_16",              exp: 525 },
                    { name: 'Volan',       gameUID: "story_17",              exp: 550 },
                    { name: 'Pyxis',       gameUID: "story_18",              exp: 575 },
                    { name: 'Loki',        gameUID: "story_19",              exp: 600 },
                ]
            }, {
                name: 'Conquest',
                atOnce: 2,
                /** @type {CampaignMapDefinition[]} */
                maps: [
                    { name: 'Grim 1',        gameUID: "conquest_0",              exp: 120 },
                    { name: 'Grim 2',        gameUID: "conquest_1",              exp: 140 },
                    { name: 'Grim 3',        gameUID: "conquest_2",              exp: 160 },
                    { name: 'Grim 4',        gameUID: "conquest_3",              exp: 180 },
                    { name: 'Grim 5',        gameUID: "conquest_4",              exp: 200 },
                    { name: 'Classic Earth',        gameUID: "special_0",              exp: 210, categoryOverride: 'Special Ops' },
                    { name: 'Super Tax-Man',        gameUID: "special_1",              exp: 210, categoryOverride: 'Special Ops' },
                    { name: 'Skuld 1',        gameUID: "conquest_5",              exp: 220 },
                    { name: 'Skuld 2',        gameUID: "conquest_6",              exp: 240 },
                    { name: 'Skuld 3',        gameUID: "conquest_7",              exp: 260 },
                    { name: 'Skuld 4',        gameUID: "conquest_8",              exp: 280 },
                    { name: 'Skuld 5',        gameUID: "conquest_9",              exp: 300 },
                    { name: 'Gump',                 gameUID: "special_2",              exp: 310, categoryOverride: 'Special Ops' },
                    { name: 'Mouse Shadow',         gameUID: "special_3",              exp: 310, categoryOverride: 'Special Ops' },
                    { name: 'Frigg 1',        gameUID: "conquest_10",              exp: 320 },
                    { name: 'Frigg 2',        gameUID: "conquest_11",              exp: 340 },
                    { name: 'Frigg 3',        gameUID: "conquest_12",              exp: 360 },
                    { name: 'Frigg 4',        gameUID: "conquest_13",              exp: 380 },
                    { name: 'Frigg 5',        gameUID: "conquest_14",              exp: 400 },
                    { name: 'Chess',                gameUID: "special_4",              exp: 410, categoryOverride: 'Special Ops' },
                    { name: 'DTD',                  gameUID: "special_5",              exp: 410, categoryOverride: 'Special Ops' },
                    { name: 'Vidar 1',        gameUID: "conquest_15",              exp: 420 },
                    { name: 'Vidar 2',        gameUID: "conquest_16",              exp: 440 },
                    { name: 'Vidar 3',        gameUID: "conquest_17",              exp: 460 },
                    { name: 'Vidar 4',        gameUID: "conquest_18",              exp: 480 },
                    { name: 'Vidar 5',        gameUID: "conquest_19",              exp: 500 },
                    { name: 'Poison',               gameUID: "special_6",              exp: 510, categoryOverride: 'Special Ops' },
                    { name: 'ChopRaider',           gameUID: "special_7",              exp: 510, categoryOverride: 'Special Ops' },
                    { name: 'Gudrun 1',        gameUID: "conquest_20",              exp: 520 },
                    { name: 'Gudrun 2',        gameUID: "conquest_21",              exp: 540 },
                    { name: 'Gudrun 3',        gameUID: "conquest_22",              exp: 560 },
                    { name: 'Gudrun 4',        gameUID: "conquest_23",              exp: 580 },
                    { name: 'Gudrun 5',        gameUID: "conquest_24",              exp: 600 },
                    { name: 'Air',                  gameUID: "special_8",              exp: 610, categoryOverride: 'Special Ops' },
                    { name: 'KC',                   gameUID: "special_9",              exp: 610, categoryOverride: 'Special Ops' },
                ]
            }]
        }

        /** @type {Object.<string, Object.<string, {mapName: string, campaignName: string, exp: number}>>} */
        this.maps = {}; //game, then guid
        
        for(let keyval of Object.entries(this.campaign)) {
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
    case 'cw4':
    case 'pf':
    case 'cw3':
    case 'cw2':
    case 'cw1': {
        //Select campaign(s) for each game
        switch(user.game) {
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
            let category = this.campaign[user.game][index];
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