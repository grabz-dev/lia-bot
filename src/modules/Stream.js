'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

export default class Stream extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS stream_main (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                channel_id VARCHAR(64) NOT NULL
            )`);
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * Module Function
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext
     * @param {|'set-channel'|'start'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'set-channel':
            setChannel.call(this, m);
            return;
        case 'start':
            if(args[0] == null)
                return this.bot.locale.category("stream", "err_game_name_not_provided");
            let game = KCLocaleManager.getPrimaryAliasFromAlias("game", args[0]);
            if(game == null)
                return this.bot.locale.category("stream", "err_game_name_not_supported", args[0]);

            switch(ext.action) {
            case 'start':
                if(args[1] == null)
                    return this.bot.locale.category("stream", "err_url_not_provided");
                let url = getValidURL(args[1]);
                if(url == null)
                    return this.bot.locale.category("stream", "err_url_bad");
                start.call(this, m, game, url);
                return;
            }
        default:
            return;
        }
    }
}

/**
 * Set channel for stream notifications.
 * @this {Stream}
 * @param {Bot.Message} m
 */
function setChannel(m) {
    this.bot.sql.transaction(async query => {
        /** @type {any[]} */
        let results = (await query(`SELECT channel_id FROM stream_main
                                    WHERE guild_id = '${m.guild.id}'
                                    FOR UPDATE`)).results;
        if(results.length > 0) {
            await query(`UPDATE stream_main SET channel_id = '${m.channel.id}'
                         WHERE guild_id = '${m.guild.id}'`);
        }
        else {
            await query(`INSERT INTO stream_main (guild_id, channel_id)
                         VALUES ('${m.guild.id}', '${m.channel.id}')`);
        }

        m.message.reply(this.bot.locale.category("stream", "channel_set")).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Start a new stream.
 * @this {Stream}
 * @param {Bot.Message} m
 * @param {string} game
 * @param {string} url
 */
function start(m, game, url) {
    this.bot.sql.transaction(async query => {
        /** @type {any} */
        let resultMain = (await query(`SELECT * FROM stream_main WHERE guild_id = '${m.guild.id}'`)).results[0];

        let channel = (!resultMain || !resultMain.channel_id ? undefined : m.guild.channels.resolve(resultMain.channel_id));
        if(!(channel instanceof Discord.TextChannel)) {
            m.message.reply(this.bot.locale.category("stream", "channel_missing")).catch(logger.error);
            return;
        }

        let emote = ':game_die:';
        await this.bot.sql.transaction(async query => {
            let result = (await query(`SELECT * FROM emotes_game
                                        WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
            if(result) emote = result.emote;
        }).catch(logger.error);

        const embed = getEmbedTemplate(m.member);
        embed.color = KCUtil.gameEmbedColors[game];
        embed.description = `Streaming ${emote}${KCLocaleManager.getDisplayNameFromAlias("game", game)}\nat ${url}`;

        channel.send({embed: embed});
        m.message.delete();
    }).catch(logger.error);
}


/////////////////////////////////////


/**
 * Validate a streaming service URL.
 * @param {string|null} str - the full URL
 * @returns {string|null} - string if the URL is correct, null if it's invalid.
 */
function getValidURL(str) {
    if(str == null) return null;

    let index =              str.indexOf("twitch.tv/");
    if(index === -1) index = str.indexOf("youtube.com/");
    if(index === -1) index = str.indexOf("youtu.be/");
    if(index === -1) index = str.indexOf("steamcommunity.com/");

    if(index === -1)
        return null;

    let url = str.slice(index, str.length);
    url = "https://" + url;
    return url;
}

/**
 * 
 * @param {Discord.GuildMember=} member 
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate(member) {
    let embed = new Discord.MessageEmbed({
        timestamp: new Date(),
    });
    if(member) {
        embed.author = {
            name: member.user.username + '#' + member.user.discriminator,
            iconURL: member.user.avatarURL() || member.user.defaultAvatarURL
        }
    }
    return embed;
}