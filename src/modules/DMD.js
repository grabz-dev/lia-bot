'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCUtil } from '../kc/KCUtil.js';
import { HttpRequest } from '../utils/HttpRequest.js';
import xml2js from 'xml2js';

const URL = 'https://knucklecracker.com/creeperworld3/dmdNameTable.php?playedfilter=4&startAt=';

/** 
 * @typedef {object} DMDMapInfo 
 * @property {number} id
 * @property {string} name
 * @property {string} owner
 */

export default class DMD extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS dmd_maps (
                id INT UNSIGNED PRIMARY KEY,
                name VARCHAR(256) NOT NULL,
                owner VARCHAR(64) NOT NULL
            )`);
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * 
     * @param {number} id
     */
    async getDMDMapInfo(id) {
        return await this.bot.sql.transaction(async query => {
            /** @type {DMDMapInfo|null} */
            let map = (await query(`SELECT * FROM dmd_maps WHERE id = ?`, [id])).results[0];
            if(map != null) {
                return map;
            }

            const xml = await HttpRequest.get(`${URL}${id}`);
            let data = await xml2js.parseStringPromise(xml);
            let fetchedMap = data?.records?.record[0];
            if(fetchedMap == null) return null;

            map = {
                id: +fetchedMap.id[0],
                name: fetchedMap.name[0],
                owner: fetchedMap.owner[0]
            }

            await query(Bot.Util.SQL.getInsert(map, "dmd_maps"));
            map = (await query(`SELECT * FROM dmd_maps WHERE id = ?`, [id])).results[0];
            return map;
        }).catch(e => {
            logger.error(e);
            return null;
        });
    }
}