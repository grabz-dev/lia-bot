'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';

export default class Emotes extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS emotes_game (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                game VARCHAR(16) NOT NULL,
                emote VARCHAR(64) NOT NULL
            )`);
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * Module Function: Associate an emote with a KC game for use with various things.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    emote(m, args, arg, ext) {
        if(args[0] == null)
            return this.bot.locale.category("emotes", "err_game_name_not_provided");
        
        let game = KCLocaleManager.getPrimaryAliasFromAlias("game", args[0]);
        if(game == null)
            return this.bot.locale.category("emotes", "err_game_name_not_supported", args[0]);

        let emote = args[1];
        if(emote == null)
            return this.bot.locale.category("emotes", "err_emote_not_provided");

        let snowflake = Bot.Util.getSnowflakeFromDiscordPing(args[1]);
        if(snowflake == null)
            return this.bot.locale.category('emotes', 'err_emote_not_correct');

        let id = snowflake;

        this.bot.sql.transaction(async query => {
            let emoji = m.guild.emojis.resolve(id);
            if(!emoji) {
                m.channel.send(this.bot.locale.category('emotes', 'err_emote_not_on_server')).catch(logger.error);
                return;
            }

            /** @type {any[]} */
            let results = (await query(`SELECT game, emote FROM emotes_game
                                        WHERE guild_id = '${m.guild.id}' AND game = '${game}'
                                        FOR UPDATE`)).results;
            if(results.length > 0) {
                await query(`UPDATE emotes_game SET emote = '${emote}'
                             WHERE guild_id = '${m.guild.id}' AND game = '${game}'`);
            }
            else {
                await query(`INSERT INTO emotes_game (guild_id, game, emote)
                             VALUES ('${m.guild.id}', '${game}', '${emote}')`);
            }

            m.message.reply(this.bot.locale.category("emotes", "success")).catch(logger.error);
        }).catch(logger.error);
    }
}