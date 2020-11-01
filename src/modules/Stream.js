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
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /** @param {Discord.GuildMember} member - The new member. */
    onGuildMemberAdd(member) {
        let guild = member.guild;

        this.bot.tdb.session(guild, "stream", async session => {
            let docsSubs = await this.bot.tdb.find(session, guild, "stream", "subscribers", { }, { u: member.id }, { g: 1 });
            for(let docSubs of docsSubs) {
                let docGame = await this.bot.tdb.findOne(session, guild, "stream", "games", { }, { _id: docSubs.g }, { r: 1 });
                if(!docGame) return;

                let role = await guild.roles.fetch(docGame.r);
                if(!role) continue;

                await member.roles.add(role, "stream subscriber rejoined server");
            }
        }).catch(logger.error);
    }

    /**
     * Module Function: Show introduction to streaming.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    info(m, args, arg, ext) {
        if(arg.length > 0) return;
        
        (async () => {
            let roleId = this.bot.getRoleId(m.guild.id, "STREAMER");
            let role = roleId ? await m.guild.roles.fetch(roleId) : undefined;

            let embed = new Discord.MessageEmbed({
                color: 4929148,
                title: this.bot.locale.category("stream", "intro_name"),
                description: this.bot.locale.category("stream", "intro_value", role ? `<@&${role.id}>` : "unset")
            });

            m.channel.send({embed: embed}).catch(logger.error);
        })();
    }

    /**
     * Module Function: Set channel for stream notifications.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    setChannel(m, args, arg, ext) {
        this.bot.tdb.session(m.guild, "stream", async session => {
            await this.bot.tdb.update(session, m.guild, "stream", "main", { upsert: true }, { _id: 1 }, {
                _id: 1,
                channelId: m.channel.id
            });
            m.message.reply(this.bot.locale.category("stream", "channel_set")).catch(logger.error);
        }).catch(logger.error);
    }

    /**
     * Module Function: Add a game for streaming purposes.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    add(m, args, arg, ext) {
        if(args[0] == null)
            return this.bot.locale.category("stream", "err_game_name_not_provided");
        
        let game = KCLocaleManager.getPrimaryAliasFromAlias("game", args[0]);
        if(game == null)
            return this.bot.locale.category("stream", "err_game_name_not_supported", args[0]);

        if(args[1] == null)
            return this.bot.locale.category("stream", "err_role_name_not_provided");

        let roleId = Bot.Util.getSnowflakeFromDiscordPing(args[1]);
        if(roleId == null)
            return this.bot.locale.category("stream", "err_role_name_not_correct");
        let id = roleId;

        this.bot.tdb.session(m.guild, "stream", async session => {
            let role = await m.guild.roles.fetch(id);
            if(role == null) {
                m.message.reply(this.bot.locale.category("stream", "err_role_name_not_on_this_server"));
                return;
            }

            await this.bot.tdb.update(session, m.guild, "stream", "games", { upsert: true }, { _id: game }, {
                _id: game,
                r: id
            });

            m.message.reply(this.bot.locale.category("stream", "add_success"));
        }).catch(logger.error);
    }

    /**
     * Module Function: Subscribe to streams for the specified game.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    subscribe(m, args, arg, ext) {
        if(args[0] == null)
            return this.bot.locale.category("stream", "err_game_name_not_provided");
        
        let game = KCLocaleManager.getPrimaryAliasFromAlias("game", args[0]) || "";
        if(game == "")
            return this.bot.locale.category("stream", "err_game_name_not_supported", args[0]);

        this.bot.tdb.session(m.guild, "stream", async session => {
            let docsGame = await this.bot.tdb.find(session, m.guild, "stream", "games", { }, { }, { r: 1 });
            if(docsGame.length === 0) {
                m.message.reply(this.bot.locale.category("stream", "subscribe_no_games")).catch(logger.error);
                return;
            }

            let roleId = docsGame.filter(e => e._id === game)[0];
            roleId = roleId ? roleId.r : undefined;
            if(!roleId) {
                m.message.reply(this.bot.locale.category("stream", "game_not_added", KCLocaleManager.getDisplayNameFromAlias("game", game) || game, docsGame.reduce((a, v) => { a.push(v._id); return a; }, []).sort().join(", "))).catch(logger.error);
                return;
            }

            let role = await m.guild.roles.fetch(roleId);
            if(!role) {
                m.message.reply(this.bot.locale.category("stream", "subscribe_game_role_missing")).catch(logger.error);
                return;
            }

            let docSub = await this.bot.tdb.findOne(session, m.guild, "stream", "subscribers", { }, {
                u: m.member.id,
                g: game
            }, { u: 1 });

            if(docSub && m.member.roles.cache.get(roleId)) {
                m.message.reply(this.bot.locale.category("stream", "subscribe_already_subbed", KCLocaleManager.getDisplayNameFromAlias("game", game) || game)).catch(logger.error);
                return;
            }

            await m.member.roles.add(role, `subscribed to ${game}`);
            if(!docSub) {
                await this.bot.tdb.insert(session, m.guild, "stream", "subscribers", { }, {
                    u: m.member.id,
                    g: game
                });
            }
            m.message.reply(this.bot.locale.category("stream", "subscribe_success", KCLocaleManager.getDisplayNameFromAlias("game", game) || game, game)).catch(logger.error);

        }).catch(logger.error);
    }

    /**
     * Module Function: Unsubscribe from streams for the specified game.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    unsubscribe(m, args, arg, ext) {
        if(args[0] == null)
            return this.bot.locale.category("stream", "err_game_name_not_provided");
        
        let game = KCLocaleManager.getPrimaryAliasFromAlias("game", args[0]) || "";
        if(game == "")
            return this.bot.locale.category("stream", "err_game_name_not_supported", args[0]);

        this.bot.tdb.session(m.guild, "stream", async session => {
            let docsGame = await this.bot.tdb.find(session, m.guild, "stream", "games", { }, { }, { r: 1 });
            if(docsGame.length === 0) {
                m.message.reply(this.bot.locale.category("stream", "unsubscribe_no_games")).catch(logger.error);
                return;
            }

            let roleId = docsGame.filter(e => e._id === game)[0];
            roleId = roleId ? roleId.r : undefined;
            if(!roleId) {
                m.message.reply(this.bot.locale.category("stream", "game_not_added", KCLocaleManager.getDisplayNameFromAlias("game", game) || game, docsGame.reduce((a, v) => { a.push(v._id); return a; }, []).sort().join(", "))).catch(logger.error);
                return;
            }
            let role = await m.guild.roles.fetch(roleId);

            let docSub = await this.bot.tdb.findOne(session, m.guild, "stream", "subscribers", { }, {
                u: m.member.id,
                g: game
            }, { u: 1 });

            if(!docSub && !m.member.roles.cache.get(roleId)) {
                m.message.reply(this.bot.locale.category("stream", "unsubscribe_not_subbed", KCLocaleManager.getDisplayNameFromAlias("game", game) || game)).catch(logger.error);
                return;
            }

            if(role) await m.member.roles.remove(role, `unsubscribed from ${game}`);
            await this.bot.tdb.remove(session, m.guild, "stream", "subscribers", { }, {
                u: m.member.id,
                g: game
            });

            m.message.reply(this.bot.locale.category("stream", "unsubscribe_success", KCLocaleManager.getDisplayNameFromAlias("game", game) || game, game)).catch(logger.error);
        }).catch(logger.error);
    }

    /**
     * Module Function: Start a new stream.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    start(m, args, arg, ext) {
        if(args[0] == null)
            return this.bot.locale.category("stream", "err_game_name_not_provided");
    
        let game = KCLocaleManager.getPrimaryAliasFromAlias("game", args[0]) || "";
        if(game == "")
            return this.bot.locale.category("stream", "err_game_name_not_supported", args[0]);

        if(args[1] == null)
            return this.bot.locale.category("stream", "err_url_not_provided");
        
        let url = getValidURL(args[1]) || "";
        if(url == "")
            return this.bot.locale.category("stream", "err_url_bad");

        this.bot.tdb.session(m.guild, "stream", async session => {
            let docMain = await this.bot.tdb.findOne(session, m.guild, "stream", "main", { }, { _id: 1 }, { channelId: 1 });

            let channel = (!docMain || !docMain.channelId ? undefined : m.guild.channels.resolve(docMain.channelId));
            if(!(channel instanceof Discord.TextChannel)) {
                m.message.reply(this.bot.locale.category("stream", "channel_missing")).catch(logger.error);
                return;
            }

            let docGame = await this.bot.tdb.findOne(session, m.guild, "stream", "games", { }, { _id: game }, { r: 1 });
            if(!docGame) {
                m.message.reply(this.bot.locale.category("stream", "game_not_added")).catch(logger.error);
                return;
            }

            let docStream = await this.bot.tdb.findOne(session, m.guild, "stream", "streams", { }, { _id: m.member.id }, { });
            if(docStream) {
                m.message.reply(this.bot.locale.category("stream", "start_already_streaming")).catch(logger.error);
                return;
            }

            let emote = ":game_die:";
            await this.bot.tdb.session(m.guild, "emotes", async session => {
                let documents = await this.bot.tdb.find(session, m.guild, "emotes", "game", { }, {_id: game}, {e: 1});
                let e = documents.find(v => v._id === game);
                if(e) emote = e.e;
            }).catch(logger.error);

            let str = ":movie_camera: <@" + m.member.id + "> is now streaming\n" + emote + " " + KCLocaleManager.getDisplayNameFromAlias("game", game) + "\n:clapper: at " + url + " !\n\n";
            let role = await m.guild.roles.fetch(docGame.r);
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

            await this.bot.tdb.update(session, m.guild, "stream", "streams", { upsert: true }, { _id: m.member.id }, {
                g: game,
                u: url,
                m: messageStream.id,
                c: channel.id
            });
        }).catch(logger.error);
    }

    /**
     * Module Function: End the user's currently running stream.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    end(m, args, arg, ext) {
        const now = Date.now();

        let url = getValidURL(args[0] || "");
        if(url == null && args[0] !== "override")
            return this.bot.locale.category("stream", "err_no_vod");

        this.bot.tdb.session(m.guild, "stream", async session => {
            let docStream = await this.bot.tdb.findOne(session, m.guild, "stream", "streams", { }, { _id: m.member.id }, { });
            if(!docStream) {
                m.message.reply(this.bot.locale.category("stream", "end_not_streaming")).catch(logger.error);
                return;
            }
            let game = docStream.g;
            
            let emote = ":game_die:";
            await this.bot.tdb.session(m.guild, "emotes", async session => {
                let documents = await this.bot.tdb.find(session, m.guild, "emotes", "game", { }, {_id: game}, {e: 1});
                let e = documents.find(v => v._id === game);
                if(e) emote = e.e;
            }).catch(logger.error);

            await this.bot.tdb.remove(session, m.guild, "stream", "streams", { }, { _id: m.member.id });

            let channel = m.guild.channels.resolve(docStream.c);
            if(channel instanceof Discord.TextChannel) {
                let message = await channel.messages.fetch(docStream.m);

                let str = ":calendar_spiral: [" + Bot.Util.getFormattedDate(now, true) + "]\n";
                str += emote + " " + KCLocaleManager.getDisplayNameFromAlias("game", game);
                str += " stream by <@" + m.member.id + "> ended.\n";
                str += url == null ? ":x: VOD not saved." : ":clapper: VOD: <" + url + ">";

                await message.edit(str);
            }
        }).catch(logger.error);
    }

    /**
     * Module Function: Show the current status of streams.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    status(m, args, arg, ext) {
        this.bot.tdb.session(m.guild, "stream", async session => {
            let docsStream = await this.bot.tdb.find(session, m.guild, "stream", "streams", { }, { _id: m.member.id }, { });
            if(docsStream.length === 0) {
                m.message.reply(this.bot.locale.category("stream", "status_no_streams")).catch(logger.error);
                return;
            }

            let message = await m.channel.send("...");
            var str = "Currently live: \n\n";
            
            for(let document of docsStream)
                str += KCLocaleManager.getDisplayNameFromAlias("game", document.g) + " <@" + document._id + "> at <" + document.u + ">\n";
            
            message.edit(str).then().catch(e => logger.error(e));
        }).catch(logger.error);
    }

    /**
     * Module Function: Synchronize the database subscriber list with the users containing the role.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    synchronize(m, args, arg, ext) {
        if(this.cache.get(m.guild.id, "synchronizing")) {
            m.message.reply(this.bot.locale.category("stream", "synchronize_ongoing")).catch(logger.error);
            return;
        }

        this.cache.set(m.guild.id, "synchronizing", true);
        this.bot.tdb.session(m.guild, "stream", async session => {
            let docsGame = await this.bot.tdb.find(session, m.guild, "stream", "games", { }, { }, { r: 1 });
            if(docsGame.length === 0) {
                m.message.reply(this.bot.locale.category("stream", "status_no_games")).catch(logger.error);
                return;
            }

            /** @type {Discord.Collection<string, Discord.Role>} */
            let games = new Discord.Collection();
            for(let document of docsGame) {
                let role = await m.guild.roles.fetch(document.r);
                if(role) games.set(document._id, role);
            }

            let docsSubs = await this.bot.tdb.find(session, m.guild, "stream", "subscribers", { }, { }, { });

            let str = this.bot.locale.category("stream", "synchronize_ing");
            let messageSync = await m.channel.send(str);

            for(let i = 0; i < docsSubs.length; i++) {
                const document = docsSubs[i];

                let role = games.get(document.g);
                if(!role) continue;

                let member = await m.guild.members.fetch(document.u);
                if(!member) continue;
                if(member.roles.cache.get(role.id)) continue;

                await Bot.Util.Promise.sleep(3000);
                await messageSync.edit(`${str}\n\n${KCLocaleManager.getDisplayNameFromAlias("game", document.g)||document.g}\n${i+1}/${docsSubs.length}\n${member.nickname || member.user.username}`);
                await member.roles.add(role, "synchronizing stream subscribers");
            }

            this.cache.set(m.guild.id, "synchronizing", false);
            await Bot.Util.Promise.sleep(3000);
            await messageSync.edit(this.bot.locale.category("stream", "synchronize_success"));
        }).catch(err => {
            this.cache.set(m.guild.id, "synchronizing", false);
            logger.error(err);
        });
    }
}

/**
 * Validate a streaming service URL.
 * @param {string} str - the full URL
 * @returns {string|null} - string if the URL is correct, null if it's invalid.
 */
function getValidURL(str) {
    let index =              str.indexOf("twitch.tv/");
    if(index === -1) index = str.indexOf("youtube.com/");
    if(index === -1) index = str.indexOf("youtu.be/");

    if(index === -1)
        return null;

    let url = str.slice(index, str.length);
    url = "https://" + url;
    return url;
}