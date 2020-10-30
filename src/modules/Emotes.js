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

        this.bot.tdb.session(m.guild, "emotes", async session => {
            await this.bot.tdb.update(session, m.guild, "emotes", "game", { upsert: true }, { _id: game }, { _id: game, e: emote });
            m.message.reply(this.bot.locale.category("emotes", "success")).catch(logger.error);
        }).catch(logger.error);
    }
}