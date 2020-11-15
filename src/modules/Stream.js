'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

import { KCLocaleManager } from '../kc/KCLocaleManager.js';

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

            await query(`CREATE TABLE IF NOT EXISTS stream_games (
                            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                            guild_id VARCHAR(64) NOT NULL,
                            game VARCHAR(8) NOT NULL,
                            role_id VARCHAR(64) NOT NULL
                         )`);

            await query(`CREATE TABLE IF NOT EXISTS stream_streams (
                            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                            guild_id VARCHAR(64) NOT NULL,
                            user_id VARCHAR(64) NOT NULL,
                            game VARCHAR(8) NOT NULL,
                            url VARCHAR(512) NOT NULL,
                            channel_id VARCHAR(64) NOT NULL,
                            message_id VARCHAR(64) NOT NULL
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
     * @param {'info'|'set-channel'|'add-game'|'start'|'end'|'status'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'info':
            if(arg.length > 0)
                return;
            info.call(this, m).catch(logger.error);
            return;
        case 'set-channel':
            setChannel.call(this, m);
            return;
        case 'add-game':
        case 'start':
            if(args[0] == null)
                return this.bot.locale.category("stream", "err_game_name_not_provided");
            let game = KCLocaleManager.getPrimaryAliasFromAlias("game", args[0]);
            if(game == null)
                return this.bot.locale.category("stream", "err_game_name_not_supported", args[0]);

            switch(ext.action) {
            case 'add-game':
                if(args[1] == null)
                    return this.bot.locale.category("stream", "err_role_name_not_provided");
                let roleId = Bot.Util.getSnowflakeFromDiscordPing(args[1]);
                if(roleId == null)
                    return this.bot.locale.category("stream", "err_role_name_not_correct");
                addGame.call(this, m, game, roleId);
                return;
            case 'start':
                if(args[1] == null)
                    return this.bot.locale.category("stream", "err_url_not_provided");
                let url = getValidURL(args[1]);
                if(url == null)
                    return this.bot.locale.category("stream", "err_url_bad");
                start.call(this, m, game, url);
                return;
            }
        case 'end':
            let url = getValidURL(args[0]);
            if(url == null && args[0] !== "override")
                return this.bot.locale.category("stream", "err_no_vod");
            end.call(this, m, url);
            return;
        case 'status':
            status.call(this, m);
            return;
        default:
            return;
        }
    }
}

/**
 * Show introduction to streaming.
 * @this {Stream}
 * @param {Bot.Message} m
 */
async function info(m) {
    let roleId = this.bot.getRoleId(m.guild.id, "STREAMER");
    let role = roleId ? await m.guild.roles.fetch(roleId).catch(() => {}) : undefined;
    let embed = new Discord.MessageEmbed({
        color: 4929148,
        title: this.bot.locale.category("stream", "intro_name"),
        description: this.bot.locale.category("stream", "intro_value", role ? `<@&${role.id}>` : "[unset]")
    });
    m.channel.send({embed: embed}).catch(logger.error);
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
 * Add a game for streaming purposes.
 * @this {Stream}
 * @param {Bot.Message} m
 * @param {string} game
 * @param {Discord.Snowflake} roleId
 */
function addGame(m, game, roleId) {
    this.bot.sql.transaction(async query => {
        let role = await m.guild.roles.fetch(roleId).catch(() => {});
        if(role == null) {
            m.message.reply(this.bot.locale.category("stream", "err_role_name_not_on_this_server")).catch(logger.error);
            return;
        }

        /** @type {any[]} */
        let results = (await query(`SELECT role_id FROM stream_games
                                    WHERE guild_id = '${m.guild.id}' AND game = '${game}'
                                    FOR UPDATE`)).results;
        if(results.length > 0) {
            await query(`UPDATE stream_games SET role_id = '${role.id}'
                         WHERE guild_id = '${m.guild.id}' AND game = '${game}'`);
        }
        else {
            await query(`INSERT INTO stream_games (guild_id, game, role_id)
                         VALUES ('${m.guild.id}', '${game}', '${role.id}')`);
        }

        m.message.reply(this.bot.locale.category("stream", "add_success")).catch(logger.error);
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

        /** @type {any} */
        let resultGames = (await query(`SELECT * FROM stream_games 
                                        WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
        if(!resultGames) {
            m.message.reply(this.bot.locale.category("stream", "game_not_added", game)).catch(logger.error);
            return;
        }

        /** @type {any} */
        let resultStreams = (await query(`SELECT * FROM stream_streams
                                          WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}'`)).results[0];
        if(resultStreams) {
            m.message.reply(this.bot.locale.category("stream", "start_already_streaming")).catch(logger.error);
            return;
        }

        let emote = ':game_die:';
        await this.bot.sql.transaction(async query => {
            let result = (await query(`SELECT * FROM emotes_game
                                        WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
            if(result) emote = result.emote;
        }).catch(logger.error);

        let str = ":movie_camera: <@" + m.member.id + "> is now streaming\n" + emote + " " + KCLocaleManager.getDisplayNameFromAlias("game", game) + "\n:clapper: at " + url + " !\n\n";
        let role = await m.guild.roles.fetch(resultGames.role_id).catch(() => {});
        if(role) str += "<@&" + role.id + ">";

        str += "\n------------------------------------";
        str += "\n\n:white_check_mark: Do you want to be notified of future streams for this game? Type `!stream subscribe " + game + "`";
        str += "\n:x: No longer want to receive these notifications? Type `!stream unsubscribe " + game + "`";
        str += "\n:information_source: Want to become a streamer? Reach out to the moderation team for questions.";

        /** @type {Discord.Message|null} */
        let messageStream = null;

        if(role) {
            await role.setMentionable(true, `new ${game} stream mention`);
            messageStream = await channel.send(str);
            await role.setMentionable(false, `new ${game} stream mention`);
        }
        else messageStream = await channel.send(str);

        await query(`INSERT INTO stream_streams (guild_id, user_id, game, url, channel_id, message_id)
                     VALUES ('${m.guild.id}', '${m.member.id}', '${game}', '${url}', '${channel.id}', '${messageStream.id}')`);
    }).catch(logger.error);
}

/**
 * End the user's currently running stream.
 * @this {Stream}
 * @param {Bot.Message} m
 * @param {string|null} url
 */
function end(m, url) {
    const now = Date.now();

    this.bot.sql.transaction(async query => {
        /** @type {any} */
        let resultStreams = (await query(`SELECT * FROM stream_streams
                                          WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}'`)).results[0];
        if(!resultStreams) {
            m.message.reply(this.bot.locale.category("stream", "end_not_streaming")).catch(logger.error);
            return;
        }

        let game = resultStreams.game;

        let emote = ':game_die:';
        await this.bot.sql.transaction(async query => {
            let result = (await query(`SELECT * FROM emotes_game
                                        WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
            if(result) emote = result.emote;
        }).catch(logger.error);

        await query(`DELETE FROM stream_streams WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}'`);

        let channel = m.guild.channels.resolve(resultStreams.channel_id);
        if(channel instanceof Discord.TextChannel) {
            let message = await channel.messages.fetch(resultStreams.message_id).catch(() => {});

            let str = ":calendar_spiral: [" + Bot.Util.getFormattedDate(now, true) + "]\n";
            str += emote + " " + KCLocaleManager.getDisplayNameFromAlias("game", game);
            str += " stream by <@" + m.member.id + "> ended.\n";
            str += url == null ? ":x: VOD not saved." : ":clapper: VOD: <" + url + ">";

            if(message) await message.edit(str);
        }

    }).catch(logger.error);
}

/**
 * Show the current status of streams.
 * @this {Stream}
 * @param {Bot.Message} m
 */
function status(m) {
    this.bot.sql.transaction(async query => {
        /** @type {any[]} */
        let resultsStreams = (await query(`SELECT * FROM stream_streams
                                          WHERE guild_id = '${m.guild.id}'`)).results;
        if(resultsStreams.length <= 0) {
            m.message.reply(this.bot.locale.category("stream", "status_no_streams")).catch(logger.error);
            return;
        }

        let message = await m.channel.send("...");
        var str = "Currently live: \n\n";
        
        for(let result of resultsStreams)
            str += KCLocaleManager.getDisplayNameFromAlias("game", result.game) + " <@" + result.user_id + "> at <" + result.url + ">\n";
        
        message.edit(str).catch(e => logger.error(e));
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

    if(index === -1)
        return null;

    let url = str.slice(index, str.length);
    url = "https://" + url;
    return url;
}