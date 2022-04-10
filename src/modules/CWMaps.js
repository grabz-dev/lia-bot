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
        if(game === 'cw2') {
            let htmlBegin = `<div class="time_posted"><strong> on:</strong> `;
            while(count > 0 && maps.length > 0) {
                const map = maps[0];
                maps.splice(0, 1);
                if(map.forumId == null) continue;
                const url = `${URLs[game]}${map.forumId}`;
                var data = await HttpRequest.get(url);
                let index = data.indexOf(htmlBegin);
                if(index === -1) {
                    log(`Failed to find date in HTML page in ${url}`)
                    await Bot.Util.Promise.sleep(10000);
                    continue;
                }
                data = data.substring(index + htmlBegin.length);
                data = data.substring(0, data.indexOf(`</div>`));
                const date = new Date(data);
                await query(`INSERT INTO cw2_maps (id, timestamp) VALUES (?, ?)`, [map.id, date.getTime()]);
                log(`New CW2 map upload date inserted. ID: ${map.id}, date: ${date}`);
                count--;
                await Bot.Util.Promise.sleep(INTERVAL);
            }
        }
        else if(game === 'cw1') {
            while(count > 0 && maps.length > 0) {
                const map = maps[0];
                maps.splice(0, 1);
                const url = `${URLs[game]}${map.id}`;
                var data = await HttpRequest.get(url);

                var search = 'class="out5Class">';
                var index = data.indexOf(search);
                if(index === -1) {
                    log(`Failed to find rating in HTML page in ${url}`)
                    await Bot.Util.Promise.sleep(10000);
                    continue;
                }
                data = data.substring(index + search.length);
                const rating = +(data.substring(0, data.indexOf('<')).trim());

                var search = 'class="votesClass">';
                var index = data.indexOf(search);
                if(index === -1) {
                    log(`Failed to find ratings in HTML page in ${url}`)
                    await Bot.Util.Promise.sleep(10000);
                    continue;
                }
                data = data.substring(index + search.length);
                const ratings = +(data.substring(0, data.indexOf(' ')).trim());
                
                data = data.substring(data.indexOf('Title:') + 6);
                data = data.substring(data.indexOf('</td>') + 5);
                data = data.substring(data.indexOf('>') + 1);
                const title = data.substring(0, data.indexOf('<')).trim();

                data = data.substring(data.indexOf('Post Date:') + 10);
                data = data.substring(data.indexOf('</td>') + 5);
                data = data.substring(data.indexOf('>') + 1);
                const date = new Date(data.substring(0, data.indexOf('<')).trim());

                data = data.substring(data.indexOf('Desc:') + 5);
                data = data.substring(data.indexOf('</td>') + 5);
                data = data.substring(data.indexOf('>') + 1);
                data = data.substring(data.indexOf('>') + 1);
                const desc = data.substring(0, data.indexOf('<')).trim();

                var search = "href='/forums/index.php?topic=";
                var index = data.indexOf(search);
                if(index === -1) {
                    log(`Failed to find forum ID in HTML page in ${url}`)
                    await Bot.Util.Promise.sleep(10000);
                    continue;
                }
                data = data.substring(index + search.length);
                const forumId = +(data.substring(0, data.indexOf("'>")).trim());

                await query(`INSERT INTO cw1_maps (id, title, rating, ratings, description, forum_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`, [map.id, title, rating, ratings, desc, forumId, date.getTime()]);
                log(`New CW1 map upload date inserted. ID: ${map.id}, title: ${title}, rating: ${rating}, ratings: ${ratings}, desc: ${desc}, forumId: ${forumId}, date: ${date}`);
                count--;
                await Bot.Util.Promise.sleep(INTERVAL);
            }
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