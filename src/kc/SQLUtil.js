'use strict';

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

/** @typedef {Array<{emote: string, game: string}>} EmoteArray */
/** @typedef {{[game: string]: string}} EmoteObject */

const FALLBACK_EMOTE = ':game_die:';

export const SQLUtil = Object.freeze({
    /**
     * Get emote for specified guild/game, usable immediately in a message
     * @param {Bot.SQLWrapper} sql
     * @param {Discord.Snowflake} guildId 
     * @param {string} game 
     * @returns {Promise<string|null>}
     */
    async getEmote(sql, guildId, game) {
        const emote = await sql.transaction(async query => {
            let result = (await query(`SELECT * FROM emotes_game WHERE guild_id = ? AND game = ?`, [guildId, game])).results[0];
            if(result != null && result.emote != null) return result.emote+'';
            else return null;
        }).catch(err => {
            logger.error(err);
            return null;
        });
        return emote;
    },

    /**
     * Get all game emotes for specified guild, usable immediately in a message
     * @param {Bot.SQLWrapper} sql
     * @param {Discord.Snowflake} guildId 
     * @param {string} game 
     * @returns {Promise<EmoteObject|null>}
     */
    async getEmotes(sql, guildId) {
        const emote = await sql.transaction(async query => {
            /** @type {EmoteArray} */
            let results = (await query(`SELECT * FROM emotes_game WHERE guild_id = ?`, [guildId])).results;
            return results.reduce((a, v) => { a[v.game] = v.emote; return a; }, /** @type {EmoteObject} */({}));
        }).catch(err => {
            logger.error(err);
            return /** @type {EmoteObject} */({});
        });
        return emote;
    }
});