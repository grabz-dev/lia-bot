'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import("../kc/KCGameMapManager").MapData} KCGameMapManager.MapData} */

/**
 * @typedef {object} Db.cw2_maps
 * @property {number} id
 * @property {number} timestamp
 */

/**
 * @typedef {object} Db.cw1_maps
 * @property {number} id
 * @property {string} title
 * @property {number} rating
 * @property {number} ratings
 * @property {string} description
 * @property {number} forum_id
 * @property {number} timestamp
 */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { HttpRequest } from '../utils/HttpRequest.js';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const URLs = {
    cw2: "https://knucklecracker.com/forums/index.php?topic=",
    cw1: "https://knucklecracker.com/creeperworld/mapcomments.php?id="
}

const INTERVAL = 10000;

export default class CWMaps extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`RENAME TABLE cw2_upload_dates TO cw2_maps`).catch(() => {});

            await query(`CREATE TABLE IF NOT EXISTS cw2_maps (
                id INT UNSIGNED PRIMARY KEY,
                timestamp BIGINT UNSIGNED NOT NULL
            )`);
            await query(`CREATE TABLE IF NOT EXISTS cw1_maps (
                id INT UNSIGNED PRIMARY KEY,
                title VARCHAR(128) NOT NULL,
                rating DECIMAL(3, 2) NOT NULL,
                ratings INT NOT NULL,
                description TEXT NOT NULL,
                forum_id INT NOT NULL,
                timestamp BIGINT UNSIGNED NOT NULL
            )`);
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * 
     * @param {KCGameMapManager} kcgmm 
     */
    async updateCW2Maps(kcgmm) {
        await this.bot.sql.transaction(async query => {
            /** @type {Db.cw2_maps[]} */
            const arr = (await query(`SELECT * FROM cw2_maps`)).results;
            /** @type {{[id: string]: { timestamp: number }}} */
            const obj = {};
            for(const date of arr) {
                obj[date.id] = {
                    timestamp: date.timestamp
                }
            }
            kcgmm.setCW2Maps(obj);
        }).catch(logger.error);
    }

    /**
     * 
     * @param {KCGameMapManager} kcgmm 
     */
    async updateCW1Maps(kcgmm) {
        await this.bot.sql.transaction(async query => {
            /** @type {Db.cw1_maps[]} */
            const arr = (await query(`SELECT * FROM cw1_maps`)).results;
            /** @type {{[id: string]: { title: string, rating: number, ratings: number, desc: string, forumId: number, timestamp: number }}} */
            const obj = {};
            for(const date of arr) {
                obj[date.id] = {
                    title: date.title,
                    rating: date.rating,
                    ratings: date.ratings,
                    desc: date.description,
                    forumId: date.forum_id,
                    timestamp: date.timestamp
                }
            }
            kcgmm.setCW1Maps(obj);
        }).catch(logger.error);
    }

    /**
     * 
     * @param {KCGameMapManager} kcgmm 
     * @param {'cw1'|'cw2'} game
     */
    async start(kcgmm, game) {
        return new Promise((resolve, reject) => {
            this._start(kcgmm, game, resolve, reject);
        })
    }

    /**
     * 
     * @param {KCGameMapManager} kcgmm 
     * @param {'cw1'|'cw2'} game
     * @param {(value: any) => void} resolve
     * @param {(reason?: any) => void} reject
     * 
     */
    async _start(kcgmm, game, resolve, reject) {
        const mapList = kcgmm.getMapListArray(game);
        let startAtMapId = 1;
        if(mapList == null) {
            log(`Couldn't find ${game} map list. Retrying in 1 minute`);
            setTimeout(kcgmm => this._start(kcgmm, game, resolve, reject), 1000 * 60);
            return;
        }
        mapList.sort((a, b) => a.id - b.id);
        await (async (mapList, kcgmm, game) => {
            await this.bot.sql.transaction(async query => {
                /** @type {Db.cw2_maps|Db.cw1_maps|null} */
                const result = (await query(`SELECT * FROM ${game}_maps ORDER BY id DESC LIMIT 1`)).results[0];
                if(result) startAtMapId = result.id + 1;
                const index = mapList.findIndex(v => v.id >= startAtMapId);
                if(index === -1) {
                    log("Caught up. Retrying in 24h");
                    setTimeout(() => this._start(kcgmm, game, resolve, reject), 1000 * 60 * 60 * 24);
                    resolve(undefined);
                    return;
                }
                const state = await this.work(game, mapList.splice(index), 10, query);
                if(state === 1) {
                    log("Success. Continuing...");
                    setTimeout(() => this._start(kcgmm, game, resolve, reject), INTERVAL);
                    return;
                }
                else if(state === 2) {
                    log("All done. Checking again in 24h");
                    setTimeout(() => this._start(kcgmm, game, resolve, reject), 1000 * 60 * 60 * 24);
                    resolve(undefined);
                    return;
                }
            }).then(async () => {
                if(game === 'cw2') await this.updateCW2Maps(kcgmm);
                else if(game === 'cw1') await this.updateCW1Maps(kcgmm);
            })
        })(mapList, kcgmm, game).catch(e => {
            logger.error(e);
            reject();
        });
    }

    /**
     * @param {'cw1'|'cw2'} game
     * @param {KCGameMapManager.MapData[]} maps
     * @param {number} count 
     * @param {SQLWrapper.Query} query
     */
    async work(game, maps, count, query) {
        while(count > 0 && maps.length > 0) {
            const map = maps[0];
            maps.splice(0, 1);
            if(game === 'cw2' && map.forumId == null) continue;
            let url;
            if(game === 'cw2') url = `${URLs[game]}${map.forumId}`;
            else url = `${URLs[game]}${map.id}`;

            const data = await HttpRequest.get(url);
            const dom = new JSDOM(data);
            const window = dom.window;
            const document = window.document;

            /** @param {string=} str - Log a string */
            async function exit(str) {
                if(str) log(str);
                count--;
                window.close();
                await Bot.Util.Promise.sleep(INTERVAL);
            }

            if(game === 'cw2') {
                let dateStr = document.querySelector('.time_posted')?.childNodes[1]?.textContent?.trim();
                console.log(dateStr);
                if(dateStr == null) { await exit(`Failed to find date in page at ${url}, ${dateStr}`); continue; }
                const date = new Date(dateStr);
                if(!Number.isFinite(+date.getTime())) { await exit(`Failed to find date in page at ${url}, ${dateStr}`); continue; }
                await query(`INSERT INTO cw2_maps (id, timestamp) VALUES (?, ?)`, [map.id, date.getTime()]);
                log(`New CW2 map upload date inserted. ID: ${map.id}, date: ${date}`);
            }
            else if(game === 'cw1') {
                const rating = +(document.getElementById(`outOfFive_${map.id}`)?.textContent?.trim()??NaN);
                if(!Number.isFinite(rating)) { await exit(`Failed to find rating in page at ${url}`); continue; }

                const ratings = +(document.getElementById(`showvotes_${map.id}`)?.textContent?.trim()?.split(' ')[0]??NaN);
                if(!Number.isFinite(ratings)) { await exit(`Failed to find ratings in page at ${url}`); continue; }

                const tables = document.querySelectorAll('table');
                if(tables.length !== 3) { await exit(`Invalid number of tables (${tables.length}) in page at ${url}`); continue; }

                const table = tables[1];
                const entries = table.querySelectorAll('tr');
                if(entries.length !== 6) { await exit(`Invalid number of entries (${entries.length}) in map table at ${url}`); continue; }

                const title = entries[0].querySelectorAll('td')[1]?.textContent?.trim();
                if(title == null) { await exit(`Failed to find title in page at ${url}`); continue; }

                const postDate = entries[3].querySelectorAll('td')[1]?.textContent?.trim();
                if(postDate == null) { await exit(`Failed to find date in page at ${url}`); continue; }
                const date = new Date(postDate);

                const desc = entries[5].querySelectorAll('td')[1]?.textContent?.trim();
                if(desc == null) { await exit(`Failed to find desc in page at ${url}`); continue; }

                const forumId = +(document.querySelector('[href^="/forums/index.php?topic="]')?.getAttribute('href')?.split('=')[1]??NaN);
                if(forumId == null) { await exit(`Failed to find forumId in page at ${url}`); continue; }

                await query(`INSERT INTO cw1_maps (id, title, rating, ratings, description, forum_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`, [map.id, title, rating, ratings, desc, forumId, date.getTime()]);
                log(`New CW1 map upload date inserted. ID: ${map.id}, title: ${title}, rating: ${rating}, ratings: ${ratings}, desc: ${desc}, forumId: ${forumId}, date: ${date}`);
            }


            await exit(); continue;
        }

        if(maps.length === 0) return 2;
        return 1;
    }
}

/**
 * 
 * @param {string} str 
 */
function log(str) {
    logger.info(`[CW2UploadDateFetch] ${str}`);
}