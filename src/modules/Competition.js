"use strict";
'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/MongoWrapper').Session} MongoWrapper.Session */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import("../kc/KCGameMapManager").MapData} KCGameMapManager.MapData} */
/** @typedef {import("../kc/KCGameMapManager").MapScoreQueryData} KCGameMapManager.MapScoreQueryData} */
/** @typedef {import("../kc/KCGameMapManager").MapLeaderboard} KCGameMapManager.MapLeaderboard} */
/** @typedef {import("../kc/KCGameMapManager").MapLeaderboardEntry} KCGameMapManager.MapLeaderboardEntry} */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

/**
 * @typedef {object} Db.Competition.Main
 * @property {object} _id - Record ID.
 * @property {Discord.Snowflake|null} c - Competition channel ID.
 * @property {number|null} ts - Start timestamp.
 * @property {number|null} te - End timestamp.
 */

/**
 * @typedef {object} Db.Competition.Maps
 * @property {object} _id - Record ID.
 * @property {string} g - Game.
 * @property {string} t - Map type.
 * @property {number=} i - Map ID. Not applicable to CW2 code map.
 * @property {number=} s2 - CW2 code map size.
 * @property {number=} c2 - CW2 code map complexity.
 * @property {string=} n2 - CW2 code map name.
 */

 /**
 * @typedef {object} Db.Competition.History.Competitions
 * @property {object} _id - Record ID.
 * @property {number} t - End timestamp.
 */

 /**
 * @typedef {object} Db.Competition.History.Maps
 * @property {object} _id - Record ID.
 * @property {object} _cid - Competition record ID.
 * @property {string} g - Game.
 * @property {string} t - Map type.
 * @property {number=} i - Map ID. Not applicable to CW2 code map.
 * @property {number=} s2 - CW2 code map size.
 * @property {number=} c2 - CW2 code map complexity.
 * @property {string=} n2 - CW2 code map name.
 */

 /**
 * @typedef {object} Db.Competition.History.Scores
 * @property {object} _id - Record ID.
 * @property {object} _mid - Map record ID.
 * @property {number} r - Player rank.
 * @property {Discord.Snowflake} u - User snowflake.
 * @property {number} t - User time.
 * @property {number} p - User plays.
 * @property {number=} s - User score. Not applicable for Particle Fleet.
 */

 /**
 * @typedef {object} Db.Competition.Register
 * @property {Discord.Snowflake} u - User snowflake.
 * @property {string} g - Game.
 * @property {string} n - Leaderboard name.
 */

 /**
 * @typedef {object} Db.Competition.Messages
 * @property {string} g - Game.
 * @property {Discord.Snowflake} m - Message snowflake.
 */

export default class Competition extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        this.games = ["pf", "cw3", "cw2"];
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /** 
     * @param {Discord.Guild} guild 
     * @param {object} ext - Custom parameters provided to function call
     * @param {KCGameMapManager} ext.kcgmm
     * @param {MongoWrapper.Session=} session
     * @returns {Promise<void>}
     */
    loop(guild, ext, session) {
        return new Promise(async (resolve, reject) => {
            /**
             * @param {MongoWrapper.Session} session 
             */
            const _loop = async session => {
                const now = Date.now();

                /** @type {Object<string, any>} */
                let emotes = {};
                await this.bot.tdb.session(guild, "emotes", async session => {
                    let documents = await this.bot.tdb.find(session, guild, "emotes", "game", { }, { }, {e: 1});
                    emotes = documents.reduce((a, v) => { a[v._id] = v.e; return a; }, {});
                }).catch(logger.error);

                const kcgmm = ext.kcgmm;
                /** @type {Db.Competition.Main|null} */
                const docMain = await this.bot.tdb.findOne(session, guild, "competition", "main", { }, { _id: 1 }, { });
                /** @type {Db.Competition.Maps[]} */
                const docsMaps = await this.bot.tdb.find(session, guild, "competition", "maps", { }, { }, { });
                /** @type {Db.Competition.Messages[]} */
                const docsMessages = await this.bot.tdb.find(session, guild, "competition", "messages", { }, { }, { });

                if(docMain == null || docMain.c == null || docMain.ts == null || docsMaps.length === 0)
                    return;

                const channel = guild.channels.resolve(docMain.c);
                if(channel == null || !(channel instanceof Discord.TextChannel))
                    return;
                
                /** @type {Discord.Collection<string, Discord.Message>} */
                const messages = new Discord.Collection();
                for(let docMessages of docsMessages) {
                    let message = await channel.messages.fetch(docMessages.m).catch(() => {});
                    if(message != null) messages.set(docMessages.g, message);
                }

                /** @type {Discord.Collection<string, Discord.MessageEmbed>} */
                const embeds = new Discord.Collection();

                //Ensure proper order of messages.
                docsMaps.sort((a, b) => this.games.indexOf(a.g) - this.games.indexOf(b.g));
                const timeLeft = (docMain.te != null) ? Math.max(0, docMain.te - now) : 0;
                for(let docMaps of docsMaps) {
                    /** @type KCGameMapManager.MapScoreQueryData */
                    let map = {
                        game: docMaps.g,
                        type: docMaps.t,
                        id: docMaps.i,
                        size: docMaps.s2,
                        complexity: docMaps.c2,
                        name: docMaps.n2
                    }
                    const fullMapLeaderboard = await ext.kcgmm.getMapScores(map, "specialevent");
                    const registeredMapLeaderboard = await getMapLeaderboardWithOnlyRegisteredUsers.bind(this)(session, guild, map.game, fullMapLeaderboard);
                    const emote = (emotes && map.game && emotes[map.game]) ? emotes[map.game] : ":map:";
                    let embed = embeds.get(map.game);
                    if(!embed) {
                        embed = getEmbedScores(KCUtil.gameEmbedColors[map.game], timeLeft);
                        embeds.set(map.game, embed);
                    }
                    let fields = embed.fields;
                    if(!fields) fields = [];
                    if(map.type === "code")
                        fields.push(await getEmbedFieldFromMapData(guild, this.bot.locale, registeredMapLeaderboard, map, emote));
                    else {
                        let mapList = kcgmm.getMapListId(map.game);
                        if(mapList && map.id) {
                            let mapData = mapList.get(map.id);
                            if(mapData) 
                                fields.push(await getEmbedFieldFromMapData(guild, this.bot.locale, registeredMapLeaderboard, map, emote, mapData));
                            else fields.push({name: "err_map_not_found", value: "err_map_not_found", inline: false});
                        }
                        else
                            fields.push({name: "err_map_invalid", value: "err_map_invalid", inline: false});
                    }

                    let message = messages.get(map.game);
                    if(!message) {
                        message = await channel.send("...");
                        messages.set(map.game, message);
                        await this.bot.tdb.update(session, guild, "competition", "messages", { upsert: true }, { g: map.game, t: "scores" }, {
                            g: map.game,
                            t: "scores",
                            m: message.id
                        });
                    }
                }

                messages.forEach((message, game) => {
                    let content = "";
                    if(emotes && emotes[game])
                        content += emotes[game] + " ";
                    content += KCLocaleManager.getDisplayNameFromAlias("game", game) || game;
                    
                    let embed = embeds.get(game);
                    if(embed == null)
                        message.edit(content, {embed: getEmbedScores(KCUtil.gameEmbedColors[game], timeLeft)}).catch(logger.error);
                    else
                        message.edit(content, {embed: embed}).catch(logger.error);
                });
                resolve();
            };

            if(session) await _loop(session);
            else this.bot.tdb.session(guild, "competition", async session => await _loop(session));
        });
    }

    /**
    * Module Function: Register this user for the competition.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    register(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category("competition", "err_game_name_not_provided");

        game = KCLocaleManager.getPrimaryAliasFromAlias("game", game) || "";
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category("competition", "err_game_name_not_supported", args[0]);

        while(arg[0] === " ")
            arg = arg.substring(1);
        if(arg.indexOf(" ") < 0)
            return this.bot.locale.category("competition", "err_leaderboard_name_not_provided");
        
        arg = arg.substring(arg.indexOf(" ") + 1);
        let name = arg;

        this.bot.tdb.session(m.guild, "competition", async session => {
            let gameName = KCLocaleManager.getDisplayNameFromAlias("game", game) || "unknown";

            /** @type Db.Competition.Register */
            var docReg = await this.bot.tdb.findOne(session, m.guild, "competition", "register", { }, { g: game, u: m.member.id, n: name }, { });
            if(docReg) {
                m.message.reply(this.bot.locale.category("competition", "already_registered_with_this_name", name, gameName)).catch(logger.error);
                return;
            }
            /** @type Db.Competition.Register */
            var docReg = await this.bot.tdb.findOne(session, m.guild, "competition", "register", { }, { g: game, n: name }, { });
            if(docReg) {
                m.message.reply(this.bot.locale.category("competition", "name_taken", name, gameName)).catch(logger.error);
                return;
            }
            /** @type Db.Competition.Register */
            var docReg = await this.bot.tdb.findOne(session, m.guild, "competition", "register", { }, { g: game, u: m.member.id }, { });
            if(docReg) {
                await this.bot.tdb.update(session, m.guild, "competition", "register", { }, { g: game, u: m.member.id }, { n: name });
                m.message.reply(this.bot.locale.category("competition", "register_name_changed", docReg.n, name, gameName)).catch(logger.error);
            }
            else {
                await this.bot.tdb.insert(session, m.guild, "competition", "register", { }, { u: m.member.id, g: game, n: name });
                m.message.reply(this.bot.locale.category("competition", "register_success", name, gameName)).catch(logger.error);
            }
        }).catch(logger.error);
    }

    /**
    * Module Function: Remove a user's registration.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    unregister(m, args, arg, ext) {
        let snowflake = args[0];
        if(snowflake == null)
            return this.bot.locale.category("competition", "err_user_mention_not_provided");

        snowflake = Bot.Util.getSnowflakeFromDiscordPing(snowflake) || "";
        if(snowflake.length === 0)
            return this.bot.locale.category("competition", "err_user_mention_not_correct");

        this.bot.tdb.session(m.guild, "competition", async session => {
            /** @type Db.Competition.Register[] */
            let docsReg = await this.bot.tdb.find(session, m.guild, "competition", "register", { }, { u: snowflake }, { });
            if(docsReg.length === 0) {
                m.message.reply(this.bot.locale.category("competition", "unregister_not_registered")).catch(logger.error);
                return;
            }

            await this.bot.tdb.remove(session, m.guild, "competition", "register", { }, { u: snowflake });
            m.message.reply(this.bot.locale.category("competition", "unregister_success", docsReg.length+"")).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Set the current channel as the competition channel.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    setChannel(m, args, arg, ext) {
        this.bot.tdb.session(m.guild, "competition", async session => {
            await this.bot.tdb.update(session, m.guild, "competition", "main", { upsert: true }, { _id: 1 }, { _id: 1, c: m.channel.id });
            await this.bot.tdb.drop(session, m.guild, "competition", "messages");
            m.message.reply(this.bot.locale.category("competition", "channel_set")).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Post competition info.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    info(m, args, arg, ext) {
        if(arg.length > 0) return;

        this.bot.tdb.session(m.guild, "competition", async session => {
            /** @type Db.Competition.Main|null */
            const docMain = await this.bot.tdb.findOne(session, m.guild, "competition", "main", { }, { _id: 1 }, { });

            if(docMain == null || docMain.c == null) {
                m.message.reply(this.bot.locale.category("competition", "info_inactive")).catch(logger.error);
                return;
            }

            m.channel.send({ embed:getEmbedInfo.bind(this)(docMain.c) }).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Post competition status.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    status(m, args, arg, ext) {
        this.bot.tdb.session(m.guild, "competition", async session => {
            /** @type Db.Competition.Main|null */
            const docMain = await this.bot.tdb.findOne(session, m.guild, "competition", "main", { }, { _id: 1 }, { });
            /** @type Db.Competition.Maps[] */
            const docsMaps = await this.bot.tdb.find(session, m.guild, "competition", "maps", { }, { }, { });

            m.channel.send({ embed:getEmbedStatus.bind(this)(m.guild, docMain, docsMaps) }).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Start a new competition.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    start(m, args, arg, ext) {
        const now = Date.now();

        let date = Date.parse(arg);
        if(Number.isNaN(date)) return this.bot.locale.category("competition", "err_end_date_invalid");

        if(now > date) {
            m.message.reply(this.bot.locale.category("competition", "end_date_in_past")).catch(logger.error);
            return;
        }
        
        this.bot.tdb.session(m.guild, "competition", async session => {
            /** @type Db.Competition.Main|null */
            const docMain = await this.bot.tdb.findOne(session, m.guild, "competition", "main", { }, { _id: 1 }, { });

            if(!docMain || docMain.c == null) {
                await m.message.reply(this.bot.locale.category("competition", "no_channel"));
                return;
            }

            let channel = m.guild.channels.resolve(docMain.c);
            if(!channel || !(channel instanceof Discord.TextChannel)) {
                await m.message.reply(this.bot.locale.category("competition", "channel_no_access"));
                return;
            }

            await this.bot.tdb.update(session, m.guild, "competition", "main", { upsert: true }, { _id: 1 }, { _id: 1, ts: now, te: date });

            channel.send(this.bot.locale.category("competition", "start_message")).catch(logger.error);
            m.message.reply(this.bot.locale.category("competition", "start_success")).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Clear the current competition.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    destroy(m, args, arg, ext) {
        this.bot.tdb.session(m.guild, "competition", async session => {
            await this.bot.tdb.remove(session, m.guild, "competition", "messages", { }, { t: "scores" });
            await this.bot.tdb.update(session, m.guild, "competition", "main", { upsert: true }, { _id: 1 }, { _id: 1, ts: null, te: null });
            await this.bot.tdb.drop(session, m.guild, "competition", "maps");

            m.message.reply(this.bot.locale.category("competition", "erased")).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Add or delete a map from the current competition.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call.
    * @param {"add"|"remove"} ext.type
    * @param {KCGameMapManager} ext.kcgmm - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    addMap(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category("competition", "err_game_name_not_provided");

        game = KCLocaleManager.getPrimaryAliasFromAlias("game", game) || "";
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category("competition", "err_game_name_not_supported", args[0]);

        const _data = ext.kcgmm.getMapQueryObjectFromCommandParameters(args);
        if(_data.err) return _data.err;
        const mapQueryData = _data.data;

        this.bot.tdb.session(m.guild, "competition", async session => {
            /** @type Db.Competition.Main|null */
            const docMain = await this.bot.tdb.findOne(session, m.guild, "competition", "main", { }, { _id: 1 }, { });

            if(!docMain || !docMain.c) {
                await m.message.reply(this.bot.locale.category("competition", "no_channel"));
                return;
            }

            if(docMain.ts == null || docMain.ts <= 0) {
                await m.message.reply(this.bot.locale.category("competition", "addmap_not_started"));
                return;
            }

            /** @type {Object<string, any>} */
            let query = {
                g: mapQueryData.game,
                t: mapQueryData.type,
                i: mapQueryData.id,
                s2: mapQueryData.size,
                c2: mapQueryData.complexity,
                n2: mapQueryData.name
            }
            Object.keys(query).forEach(key => typeof query[key] === "undefined" ? delete query[key] : '');

            switch(ext.type) {
            case "remove":
                /** @type Db.Competition.Maps */
                var docMaps = await this.bot.tdb.findOne(session, m.guild, "competition", "maps", { }, query, { });
                if(!docMaps) {
                    await m.message.reply(this.bot.locale.category("competition", "removemap_not_added"));
                    return;
                }

                await this.bot.tdb.remove(session, m.guild, "competition", "maps", { }, query);
                await m.message.reply(this.bot.locale.category("competition", "removemap_success"));
                break;
            case "add":
            default:
                /** @type Db.Competition.Maps */
                var docMaps = await this.bot.tdb.findOne(session, m.guild, "competition", "maps", { }, query, { });
                if(docMaps) {
                    await m.message.reply(this.bot.locale.category("competition", "addmap_already_added"));
                    return;
                }

                /** @type Db.Competition.History.Maps */
                var docHistoryMaps = await this.bot.tdb.findOne(session, m.guild, "competition", "history.maps", { }, query, { });
                if(docHistoryMaps) {
                    await m.message.reply(this.bot.locale.category("competition", "addmap_already_in_history"));
                    return;
                }

                await this.bot.tdb.insert(session, m.guild, "competition", "maps", { }, query);
                await m.message.reply(this.bot.locale.category("competition", "addmap_success"));
                break;
            }

            await this.loop(m.guild, {kcgmm: ext.kcgmm}, session);
        }).catch(logger.error);
    }

    /**
    * Module Function: Force update the scores.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call.
    * @param {KCGameMapManager} ext.kcgmm - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    update(m, args, arg, ext) {
        this.loop(m.guild, {kcgmm: ext.kcgmm}).catch(logger.error);
        m.message.reply(this.bot.locale.category("competition", "scores_updated")).catch(logger.error);
    }

    /**
    * Module Function: End the current competition, save it to history, tally up scores and post all related messages.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call.
    * @param {KCGameMapManager} ext.kcgmm - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    end(m, args, arg, ext) {
        const now = Date.now();

        this.bot.tdb.session(m.guild, "competition", async session => {
            await m.message.reply(this.bot.locale.category("competition", "end_in_progress"));

            /** @type {Object.<string, any>} */
            let emotes = {};
            await this.bot.tdb.session(m.guild, "emotes", async session => {
                let documents = await this.bot.tdb.find(session, m.guild, "emotes", "game", { }, { }, {e: 1});
                emotes = documents.reduce((a, v) => { a[v._id] = v.e; return a; }, {});
            }).catch(logger.error);

            /** @type Db.Competition.Main|null */
            const docMain = await this.bot.tdb.findOne(session, m.guild, "competition", "main", { }, { _id: 1 }, { });
            /** @type Db.Competition.Maps[] */
            const docsMaps = await this.bot.tdb.find(session, m.guild, "competition", "maps", { }, { }, { _id: 0 });

            if(!docMain || docMain.c == null) {
                await m.message.reply(this.bot.locale.category("competition", "no_channel"));
                return;
            }
            const channel = m.guild.channels.resolve(docMain.c);
            if(!channel || !(channel instanceof Discord.TextChannel)) {
                await m.message.reply(this.bot.locale.category("competition", "channel_no_access"));
                return;
            }
            if(!docMain.ts) {
                await m.message.reply(this.bot.locale.category("competition", "not_running"));
                return;
            }
            if(docsMaps.length === 0) {
                await m.message.reply(this.bot.locale.category("competition", "cant_end_no_maps"));
                return;
            }

            await this.loop(m.guild, { kcgmm: ext.kcgmm }, session);

            await Bot.Util.Promise.sleep(1000);
            await channel.send(this.bot.locale.category("competition", "end_channel_ended"));

            const maps = new Discord.Collection();

            //Ensure proper order of messages.
            docsMaps.sort((a, b) => this.games.indexOf(a.g) - this.games.indexOf(b.g));
            for(let docMaps of docsMaps) {
                /** @type {KCGameMapManager.MapScoreQueryData} */
                let map = {
                    game: docMaps.g,
                    type: docMaps.t,
                    id: docMaps.i,
                    size: docMaps.s2,
                    complexity: docMaps.c2,
                    name: docMaps.n2
                }
                /** @type {{ r: number; u: string; t: number; p: number; s: number | undefined; }[]} */
                let scores = [];

                const fullMapLeaderboard = await ext.kcgmm.getMapScores(map, "specialevent");
                const registeredMapLeaderboard = await getMapLeaderboardWithOnlyRegisteredUsers.bind(this)(session, m.guild, map.game, fullMapLeaderboard);
                registeredMapLeaderboard.entries.forEach(score => scores.push({
                    r: score.rank,
                    u: score.user,
                    t: score.time,
                    p: score.plays,
                    s: score.score
                }));
                
                maps.set(docMaps, scores);
                
                const mapList = ext.kcgmm.getMapListId(map.game);
                const mapData = !mapList || map.id == null ? undefined : mapList.get(map.id);

                const embed = getEmbedTemplate();
                const field = await getEmbedFieldFromMapData(m.guild, this.bot.locale, registeredMapLeaderboard, map, emotes[map.game], mapData);
                embed.title = field.name;
                embed.description = field.value;
                embed.footer = {
                    text: Bot.Util.getFormattedDate(docMain.ts || 0, true) + " - " + Bot.Util.getFormattedDate(now, true),
                }
                
                await channel.send({embed: embed});
            }

            /** @type Db.Competition.History.Competitions */
            let docCompNew = await this.bot.tdb.insert(session, m.guild, "competition", "history.competitions", { }, {
                t: now,
            });

            for(let map of maps.keys()) {
                /** @type Db.Competition.History.Maps */
                let docMapsNew = await this.bot.tdb.insert(session, m.guild, "competition", "history.maps", { }, Object.assign({
                    _cid: docCompNew._id
                }, map));

                let scores = maps.get(map);
                for(let score of scores) {
                    /** @type Db.Competition.History.Scores */
                    let docScoresNew = await this.bot.tdb.insert(session, m.guild, "competition", "history.scores", { }, Object.assign({
                        _mid: docMapsNew._id
                    }, score));
                }
            }

            await this.bot.tdb.remove(session, m.guild, "competition", "messages", { }, { t: "scores" });
            await this.bot.tdb.update(session, m.guild, "competition", "main", { upsert: true }, { _id: 1 }, { _id: 1, ts: null, te: null });
            await this.bot.tdb.drop(session, m.guild, "competition", "maps");

            await m.message.reply(this.bot.locale.category("competition", "end_success"));
            await buildScoreTally.bind(this)(m.guild, channel, session);
        }).catch(logger.error);
    }

    /**
    * Module Function: Rebuild the competition tally.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call.
    * @param {KCGameMapManager} ext.kcgmm - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    buildTally(m, args, arg, ext) {
        this.bot.tdb.session(m.guild, "competition", async session => {
            await buildScoreTally.bind(this)(m.guild, m.channel, session);
        }).catch(logger.error);
    }
}

/**
 * @this Competition
 * @param {Discord.Guild} guild 
 * @param {Discord.TextChannel} channel
 * @param {MongoWrapper.Session} session
 * @returns {Promise<Discord.Message>}
 */
async function buildScoreTally(guild, channel, session) {
    const roleId = this.bot.getRoleId(guild.id, "CHAMPION_OF_KC");
    const role = roleId ? guild.roles.cache.get(roleId) : undefined;

    /** @type {Discord.Collection<Discord.Snowflake, number>} */
    const champions = new Discord.Collection();

    let weeks = 2;
    let i = 1;

    /** @type {Db.Competition.History.Competitions[]} */
    var docsComps = await this.bot.tdb.find(session, guild, "competition", "history.competitions", { }, { }, { });
    docsComps = docsComps.slice(docsComps.length - weeks, docsComps.length);
    
    for(let docComps of docsComps) {
        /** @type {Db.Competition.History.Maps[]} */
        let docsMaps = await this.bot.tdb.find(session, guild, "competition", "history.maps", { }, { _cid: docComps._id }, { });
        for(let docMaps of docsMaps) {
            /** @type {Db.Competition.History.Scores[]} */
            let docsScores = await this.bot.tdb.find(session, guild, "competition", "history.scores", { }, { _mid: docMaps._id }, { });
            for(let docScores of docsScores) {
                if(docScores.r !== 1) continue;
                
                champions.set(docScores.u, i);
            }
        }
        i++;
    }

    champions.sort((a, b) => {
        return b - a;
    });

    if(role) {
        let arr = [];
        for(let member of role.members.array()) {
            arr.push(member.roles.remove(role).catch(logger.error));
        }

        for(let p of arr)
            await p;
    }

    const embed = getEmbedTemplate();
    const field = {
        name: "Current champions",
        value: "",
        inline: false
    }
    for(let champion of champions) {
        let weeks = champion[1];
        let snowflake = champion[0];

        field.value += `\`${weeks} weeks left\` <@${snowflake}>\n`;

        if(role) {
            let member = await guild.members.fetch(snowflake);
            if(member) member.roles.add(role).catch(logger.error);
        }
    }
    if(field.value.length === 0) field.value = "None";
    
    embed.fields = [];
    embed.fields.push(field);

    return await channel.send({embed: embed});
}

/**
 * @this Competition
 * Get the status embed
 * @param {Discord.Guild} guild
 * @param {Db.Competition.Main|null} docMain
 * @param {Db.Competition.Maps[]} docMaps
 * @returns {Discord.MessageEmbed}
 */
function getEmbedStatus(guild, docMain, docMaps) {
    const locale = this.bot.locale;

    let embed = new Discord.MessageEmbed({
        color: 1146986,
        title: this.bot.locale.category("competition", "status_title"),
        description: ""
    });
    embed.fields = [];

    embed.description += "Channel: "; 
    if(docMain && docMain.c != null) {
        let channel = guild.channels.resolve(docMain.c);
        embed.description += channel ? "<#" + channel.id + ">" : "no access";
    }
    else embed.description += "unset";
    
    embed.description += "\n";
    embed.description += "Status: ";
    if(docMain) {
        embed.description += docMain.ts ? "Started " + Bot.Util.getFormattedDate(docMain.ts, true) : "Not started";
    }
    else embed.description += "-";

    //TODO
    /*let field = {
        name: "Maps",
        value: "-"
    }

    if(docMaps.length > 0) {
        field.value = "";
        for(let map of docMaps) {
            let str = "";
            str += map.g + map.i + map.t + map.s2 + map.c2;
            field.value += str + "\n";
        }
    }

    embed.fields[0] = field;*/

    return embed;
}

/**
 * @this Competition
 * Get the info embed
 * @param {Discord.Snowflake} channelId - The competition channel ID
 * @returns {Discord.MessageEmbed}
 */
function getEmbedInfo(channelId) {
    const locale = this.bot.locale;

    return new Discord.MessageEmbed({
        color: 1146986,
        title: this.bot.locale.category("competition", "info_title"),
        description: this.bot.locale.category("competition", "info_description", "<#" + channelId + ">")
    });
}

/**
 * Get number of points player will receive for placing on different ranks on the leaderboards.
 * These are safe to change, the system will adjust retroactively to new scoring rules.
 * @param {number} rank
 * @returns {number} The amount of points.
 */
function getPointsFromRank(rank) {
    switch(Number(rank)) {
        case 1: return 25;
        case 2: return 20;
        case 3: return 16;
        case 4: return 13;
        case 5: return 11;
        case 6: return 10;
        case 7: return 9;
        case 8: return 8;
        case 9: return 7;
        case 10: return 6;
        case 11: return 5;
        case 12: return 4;
        case 13: return 3;
        case 14: return 2;
        default: return 1;
    }
}

/**
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate() {
    return new Discord.MessageEmbed({
        color: 1482885,
        description: "",
    });
}

/**
 * @param {number} color
 * @param {number} timeRemaining - in milliseconds.
 * @returns {Discord.MessageEmbed}
 */
function getEmbedScores(color, timeRemaining) {
    return new Discord.MessageEmbed({
        color: color,
        description: "",
        timestamp: new Date(),
        footer: {
            text: "Ends in " + Bot.Util.getFormattedTimeRemaining(timeRemaining)
        }
    });
}

/**
 * @param {Discord.Guild} guild
 * @param {Bot.Locale} locale
 * @param {KCGameMapManager.MapLeaderboard} mapLeaderboard
 * @param {KCGameMapManager.MapScoreQueryData} mapScoreQueryData 
 * @param {string} emoteStr
 * @param {KCGameMapManager.MapData=} mapData
 * @returns {Promise<{name: string, value: string, inline: boolean}>}
 */
async function getEmbedFieldFromMapData(guild, locale, mapLeaderboard, mapScoreQueryData, emoteStr, mapData) {
    let name = `${emoteStr} ${KCLocaleManager.getDisplayNameFromAlias("map_mode_custom", `${mapScoreQueryData.game}_${mapScoreQueryData.type}`)}`;
    let value = "";

    switch(mapScoreQueryData.type) {
        case "code":
            name += `: ${mapScoreQueryData.name}`;
            value = "Code: `" + mapScoreQueryData.name + "`\n";
            value += "Size: " + (KCLocaleManager.getDisplayNameFromAlias("cw2_code_map_size", mapScoreQueryData.size+"") || mapScoreQueryData.size) + "\n";
            value += "Complexity: " + (KCLocaleManager.getDisplayNameFromAlias("cw2_code_map_complexity", mapScoreQueryData.complexity+"") || mapScoreQueryData.complexity) + "\n";
            break;
        case "dmd":
            name += `: #${mapScoreQueryData.id}`;
            break;
        default:
            if(!mapData) {
                name = "err_map_invalid_2";
                value = "err_map_invalid_2";
                break;
            }
            name += `: #${mapData.id}`;
            value = `${mapData.title} (by ${mapData.author})\n`;
            value += `${getDifficultyStringFromMapData(mapData)}, ${mapData.width}x${mapData.height}`;
            break;
    }

    value += "```";
    for(let i = 0; i < mapLeaderboard.entries.length; i++) {
        const entry = mapLeaderboard.entries[i];
        if(i > 9) {
            value += (mapLeaderboard.entries.length - i + 1) + " more scores...";
            break;
        }

        value += "#" + Bot.Util.String.fixedWidth(entry.rank+"", 2, "⠀", true);
        value += Bot.Util.String.fixedWidth(KCUtil.getFormattedTimeFromFrames(entry.time), 7, "⠀", false);

        let member = await guild.members.fetch(entry.user);
        value += " " + (member ? member.nickname || member.user.username : entry.user).substring(0, 17) + "\n";
    }
    if(mapLeaderboard.entries.length === 0)
        value += "No scores yet!";
    value += "```";

    value = value.substring(0, KCUtil.embedLimits.fieldValue);

    return {
        name: name,
        value: value,
        inline: false,
    }
}

/**
 * 
 * @param {KCGameMapManager.MapData} mapData 
 * @returns {string}
 */
function getDifficultyStringFromMapData(mapData) {
    if(mapData.scores) {
        let ratio = mapData.scores / mapData.downloads;
        let percentage = Math.floor(ratio * 100) + "%";
        let str = `${percentage} clears`;
        return str;
    }
    
    return `{${mapData.downloads}} downloads`;
}

/**
 * 
 * @param {KCGameMapManager.MapData} mapData 
 * @returns {string}
 */
function getDifficultyEmoteFromMapData(mapData) {
    if(mapData.scores == null)
        return `:book:`;

    let ratio = mapData.scores / mapData.downloads;
    
    if(ratio <= 0.3)
        return `:orange_book:`;
    else if(ratio <= 0.15)
        return `:closed_book:`;
    else if(ratio <= 0.03)
        return `:notebook:`;
    else
        return `:green_book:`;
}

/**
 * @this Competition
 * @param {MongoWrapper.Session} session
 * @param {Discord.Guild} guild
 * @param {string} game
 * @param {KCGameMapManager.MapLeaderboard} mapLeaderboard 
 * @returns {Promise<KCGameMapManager.MapLeaderboard>} New leaderboard without users that haven't registered on Discord.
 */
async function getMapLeaderboardWithOnlyRegisteredUsers(session, guild, game, mapLeaderboard) {
    /** @type {KCGameMapManager.MapLeaderboard} */
    const newLeaderboard = { ...mapLeaderboard }
    newLeaderboard.entries = [];

    let rank = 1;
    for(let entry of mapLeaderboard.entries) {
        /** @type {Db.Competition.Register} */
        let docReg = await this.bot.tdb.findOne(session, guild, "competition", "register", { }, { n: entry.user }, { });
        if(docReg == null) continue;

        let member = await guild.members.fetch(docReg.u);
        if(member == null) continue;

        let newEntry = { ...entry };
        newEntry.user = member.id;
        newEntry.rank = rank;
        rank++;

        newLeaderboard.entries.push(newEntry);
    }

    return newLeaderboard;
};