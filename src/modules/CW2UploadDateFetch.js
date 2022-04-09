'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import("../kc/KCGameMapManager").MapData} KCGameMapManager.MapData} */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { HttpRequest } from '../utils/HttpRequest.js';

const URL = "https://knucklecracker.com/forums/index.php?topic=";
const HTML_BEGIN = `<div class="time_posted"><strong> on:</strong> `;
const HTML_END = `</div>`;

export default class CW2UploadDateFetch extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS cw2_upload_dates (
                id INT UNSIGNED PRIMARY KEY,
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
    async updateCW2UploadDates(kcgmm) {
        await this.bot.sql.transaction(async query => {
            const arr = (await query(`SELECT * FROM cw2_upload_dates`)).results;
            /** @type {{[id: string]: number}} */
            const obj = {};
            for(const date of arr) {
                obj[date.id] = date.timestamp;
            }
            kcgmm.setCW2UploadDates(obj);
        }).catch(logger.error);
    }

    /**
     * 
     * @param {KCGameMapManager} kcgmm 
     */
    async start(kcgmm) {
        const mapList = kcgmm.getMapListArray('cw2');
        let startAtMapId = 1;
        if(mapList == null) {
            log("Couldn't find CW2 map list. Retrying in 1 minute");
            setTimeout(kcgmm => this.start(kcgmm), 1000 * 60);
            return;
        }
        mapList.sort((a, b) => a.id - b.id);
        ((mapList, kcgmm) => {
            this.bot.sql.transaction(async query => {
                const result = (await query(`SELECT * FROM cw2_upload_dates ORDER BY id DESC LIMIT 1`)).results[0];
                if(result) startAtMapId = result.id + 1;
                const index = mapList.findIndex(v => v.id >= startAtMapId);
                if(index === -1) {
                    log("Caught up. Retrying in 24h");
                    setTimeout(() => this.start(kcgmm), 1000 * 60 * 60 * 24);
                    return;
                }
                const state = await this.work(mapList.splice(index), 10, query);
                if(state === 1) {
                    log("Success. Continuing...");
                    setTimeout(() => this.start(kcgmm), 10000);
                    return;
                }
                else if(state === 2) {
                    log("All done. Checking again in 24h");
                    setTimeout(() => this.start(kcgmm), 1000 * 60 * 60 * 24);
                    return;
                }
            }).then(async () => {
                await this.updateCW2UploadDates(kcgmm);
            }).catch(logger.error);
        })(mapList, kcgmm);
    }

    /**
     * @param {KCGameMapManager.MapData[]} maps
     * @param {number} count 
     * @param {SQLWrapper.Query} query
     */
    async work(maps, count, query) {
        while(count > 0 && maps.length > 0) {
            const map = maps[0];
            maps.splice(0, 1);
            const url = `${URL}${map.forumId}`;
            var data = await HttpRequest.get(url);
            let index = data.indexOf(HTML_BEGIN);
            if(index === -1) {
                log(`Failed to find date in HTML page in ${url}`)
                await Bot.Util.Promise.sleep(10000);
                continue;
            }
            data = data.substring(index + HTML_BEGIN.length);
            data = data.substring(0, data.indexOf(HTML_END));
            const date = new Date(data);
            await query(`INSERT INTO cw2_upload_dates (id, timestamp) VALUES (?, ?)`, [map.id, date.getTime()]);
            log(`New CW2 map upload date inserted. ID: ${map.id}, date: ${date}`);
            count--;
            await Bot.Util.Promise.sleep(10000);
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