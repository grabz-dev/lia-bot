'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */
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
 * @typedef {object} Db.competition_main
 * @property {number} id - Primary key
 * @property {Discord.Snowflake|null} channel_id - Competition channel ID.
 * @property {number|null} time_start - Start timestamp.
 * @property {number|null} time_end - End timestamp.
 */

/**
 * @typedef {object} Db.competition_maps
 * @property {object} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {string} game - Game.
 * @property {string} type - Map type.
 * @property {number|null} map_id - Map ID. Not applicable to CW2 code map.
 * @property {number|null} size - CW2 code map size.
 * @property {number|null} complexity - CW2 code map complexity.
 * @property {string|null} name - CW2 code map name.
 */

 /**
 * @typedef {object} Db.competition_history_competitions
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {number} time_end - End timestamp.
 */

 /**
 * @typedef {object} Db.competition_history_maps
 * @property {number} id - Primary key
 * @property {number} id_competition_history_competitions - competition_history_competitions key ID.
 * @property {string} game - Game.
 * @property {string} type - Map type.
 * @property {number|null} map_id - Map ID. Not applicable to CW2 code map.
 * @property {number|null} size - CW2 code map size.
 * @property {number|null} complexity - CW2 code map complexity.
 * @property {string|null} name - CW2 code map name.
 */

 /**
 * @typedef {object} Db.competition_history_scores
 * @property {number} id - Primary key
 * @property {number} id_competition_history_maps - competition_history_maps key ID.
 * @property {number} user_rank - Player rank.
 * @property {Discord.Snowflake} user_id - User snowflake.
 * @property {number} time - User time.
 * @property {number} plays - User plays.
 * @property {number|null} score - User score. Not applicable for Particle Fleet.
 */

 /**
 * @typedef {object} Db.competition_register
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {Discord.Snowflake} user_id
 * @property {string} game
 * @property {string} user_name
 */

 /**
 * @typedef {object} Db.competition_messages
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {string} game - Game.
 * @property {Discord.Snowflake} message_id - Message snowflake.
 */

export default class Competition extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        this.games = ["pf", "cw3", "cw2"];

        this.bot.sql.transaction(async query => {
            

            await query(`CREATE TABLE IF NOT EXISTS competition_main (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                channel_id VARCHAR(64),
                time_start BIGINT,
                time_end BIGINT
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_messages (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                game VARCHAR(16) NOT NULL,
                message_id VARCHAR(64) NOT NULL
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_maps (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                game VARCHAR(16) NOT NULL,
                type VARCHAR(16) NOT NULL,
                map_id MEDIUMINT UNSIGNED,
                size TINYINT UNSIGNED,
                complexity TINYINT UNSIGNED,
                name VARCHAR(128)
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_history_competitions (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                time_end BIGINT NOT NULL
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_history_maps (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_competition_history_competitions INT UNSIGNED NOT NULL,
                game VARCHAR(16) NOT NULL,
                type VARCHAR(16) NOT NULL,
                map_id MEDIUMINT UNSIGNED,
                size TINYINT UNSIGNED,
                complexity TINYINT UNSIGNED,
                name VARCHAR(128)
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_history_scores (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_competition_history_maps INT UNSIGNED NOT NULL,
                user_rank SMALLINT UNSIGNED NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                time BIGINT UNSIGNED NOT NULL,
                plays SMALLINT UNSIGNED NOT NULL,
                score MEDIUMINT UNSIGNED
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_register (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                game VARCHAR(16) NOT NULL,
                user_name VARCHAR(128) NOT NULL
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
     * @param {'register'|'unregister'|'set-channel'|'info'|'status'|'start'|'destroy'|'add-map'|'remove-map'|'update'|'build-tally'|'end'|'map'} ext.action - Custom parameters provided to function call.
     * @param {KCGameMapManager} ext.kcgmm
     * @param {import('./Map.js').default} ext.map
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'register':
        case 'add-map':
        case 'remove-map':
        case 'map':
            let game = args[0];
            if(game == null)
                return this.bot.locale.category("competition", "err_game_name_not_provided");
            
            game = KCLocaleManager.getPrimaryAliasFromAlias("game", game) || "";
            if(game.length === 0 || !this.games.includes(game))
                return this.bot.locale.category("competition", "err_game_name_not_supported", args[0]);

            switch(ext.action) {
            case 'register':
                while(arg[0] === " ")
                    arg = arg.substring(1);
                if(arg.indexOf(" ") < 0)
                    return this.bot.locale.category("competition", "err_leaderboard_name_not_provided");

                arg = arg.substring(arg.indexOf(" ") + 1);
                let name = arg;

                register.call(this, m, game, name);
                return;
            case 'add-map':
            case 'remove-map':
                const _data = ext.kcgmm.getMapQueryObjectFromCommandParameters(args);
                if(_data.err) return _data.err;
                const mapQueryData = _data.data;

                addMap.call(this, m, ext.action, game, mapQueryData, ext.kcgmm);
                return;
            case 'map':
                map.call(this, m, ext.kcgmm, game, ext.map);
                return;
            }
        case 'unregister':
            let snowflake = args[0];
            if(snowflake == null)
                return this.bot.locale.category("competition", "err_user_mention_not_provided");

            snowflake = Bot.Util.getSnowflakeFromDiscordPing(snowflake) || "";
            if(snowflake.length === 0)
                return this.bot.locale.category("competition", "err_user_mention_not_correct");

            unregister.call(this, m, snowflake);
            return;
        case 'set-channel':
            setChannel.call(this, m);
            return;
        case 'info':
            if(arg.length > 0) return;
            info.call(this, m);
            return;
        case 'status':
            status.call(this, m);
            return;
        case 'start':
            const now = Date.now();
            let date = Date.parse(arg);
            if(Number.isNaN(date)) return this.bot.locale.category("competition", "err_end_date_invalid");
            if(now > date) {
                m.message.reply(this.bot.locale.category("competition", "end_date_in_past")).catch(logger.error);
                return;
            }
            start.call(this, m, now, date);
            return;
        case 'destroy':
            destroy.call(this, m);
            return;
        case 'update':
            update.call(this, m, ext.kcgmm);
            return;
        case 'build-tally':
            buildTally.call(this, m);
            return;
        case 'end':
            end.call(this, m, ext.kcgmm);
            return;
        case 'map':
        }
    }
    
    /** 
     * @param {Discord.Guild} guild 
     * @param {KCGameMapManager} kcgmm
     * @returns {Promise<void>}
     */
    async loop(guild, kcgmm) {
        const now = Date.now();

        /** @type {Object.<string, string>} */
        let emotes = {};
        await this.bot.sql.transaction(async query => {
            /** @type {any[]} */
            let results = (await query(`SELECT * FROM emotes_game
                                       WHERE guild_id = '${guild.id}'`)).results;
            emotes = results.reduce((a, v) => { a[v.game] = v.emote; return a; }, {});
        }).catch(logger.error);

        await this.bot.sql.transaction(async query => {
            /** @type {Db.competition_main|null} */
            let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}'`)).results[0];
            /** @type {Db.competition_maps[]} */
            let resultsMaps = (await query(`SELECT * FROM competition_maps WHERE guild_id = '${guild.id}'`)).results;
            /** @type {Db.competition_messages[]} */
            let resultsMessages = (await query(`SELECT * FROM competition_messages WHERE guild_id = '${guild.id}'`)).results;

            if(resultMain == null || resultMain.channel_id == null || 
            resultMain.time_start == null || resultsMaps.length <= 0)
                return;
            
            const channel = guild.channels.resolve(resultMain.channel_id);
            if(channel == null || !(channel instanceof Discord.TextChannel))
                return;
                
            /** @type {Discord.Collection<string, Discord.Message>} */
            const messages = new Discord.Collection();
            for(let resultMessages of resultsMessages) {
                let message = await channel.messages.fetch(resultMessages.message_id).catch(() => {});
                if(message != null) messages.set(resultMessages.game, message);
            }

            /** @type {Discord.Collection<string, Discord.MessageEmbed>} */
            const embeds = new Discord.Collection();

            //Ensure proper order of messages.
            resultsMaps.sort((a, b) => this.games.indexOf(a.game) - this.games.indexOf(b.game));
            const timeLeft = (resultMain.time_end != null) ? Math.max(0, resultMain.time_end - now) : 0;

            for(let resultMaps of resultsMaps) {
                let map = getMapScoreQueryDataFromDatabase(resultMaps);

                const fullMapLeaderboard = await kcgmm.getMapScores(map, "specialevent");
                const registeredMapLeaderboard = await getMapLeaderboardWithOnlyRegisteredUsers.bind(this)(query, guild, map.game, fullMapLeaderboard);
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
                    
                    await query(`INSERT INTO competition_messages (guild_id, game, message_id)
                        VALUES ('${guild.id}', '${map.game}', '${message.id}')`);
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
        }).catch(logger.error);
    }
}

/**
 * Register this user for the competition.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game
 * @param {string} name
 */
function register(m, game, name) {
    this.bot.sql.transaction(async query => {
        await query(`SELECT user_name FROM competition_register
            WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}' AND game = '${game}'
            FOR UPDATE`);

        let gameName = KCLocaleManager.getDisplayNameFromAlias("game", game) || "unknown";

        /** @type {Db.competition_register} */
        var resultRegister = (await query(`SELECT * FROM competition_register
            WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}' AND game = '${game}' AND user_name = '${name}'`)).results[0];
        if(resultRegister) {
            m.message.reply(this.bot.locale.category("competition", "already_registered_with_this_name", name, gameName)).catch(logger.error);
            return;
        }

        /** @type {Db.competition_register} */
        var resultRegister = (await query(`SELECT * FROM competition_register
            WHERE guild_id = '${m.guild.id}' AND game = '${game}' AND user_name = '${name}'`)).results[0];
        if(resultRegister) {
            m.message.reply(this.bot.locale.category("competition", "name_taken", name, gameName)).catch(logger.error);
            return;
        }

        /** @type {Db.competition_register} */
        var resultRegister = (await query(`SELECT * FROM competition_register
            WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}' AND game = '${game}'`)).results[0];
        if(resultRegister) {
            await query(`UPDATE competition_register SET user_name = '${name}'
                WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}' AND game = '${game}'`);

            m.message.reply(this.bot.locale.category("competition", "register_name_changed", resultRegister.user_name, name, gameName)).catch(logger.error);
        }
        else {
            await query(`INSERT INTO competition_register (guild_id, user_id, game, user_name)
                VALUES ('${m.guild.id}', '${m.member.id}', '${game}', '${name}')`);
    
            m.message.reply(this.bot.locale.category("competition", "register_success", name, gameName)).catch(logger.error);
        }
    }).catch(logger.error);
}

/**
 * Remove a user's registration.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {Discord.Snowflake} snowflake
 */
function unregister(m, snowflake) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.competition_register[]} */
        var resultsRegister = (await query(`SELECT * FROM competition_register
            WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}'`)).results;

        if(resultsRegister.length <= 0) {
            m.message.reply(this.bot.locale.category("competition", "unregister_not_registered")).catch(logger.error);
            return;
        }

        await query(`DELETE FROM competition_register
            WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}'`);

        m.message.reply(this.bot.locale.category("competition", "unregister_success", resultsRegister.length+"")).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Set the current channel as the competition channel.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function setChannel(m) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.competition_main|null} */
        let resultMain = (await query(`SELECT channel_id FROM competition_main WHERE guild_id = '${m.guild.id}'
            FOR UPDATE`)).results[0];

        if(resultMain)
            await query(`UPDATE competition_main SET channel_id = '${m.channel.id}' WHERE guild_id = '${m.guild.id}'`);
        else
            await query(`INSERT INTO competition_main (guild_id, channel_id) VALUES ('${m.guild.id}', '${m.channel.id}')`);
            
        await query(`DELETE FROM competition_messages WHERE guild_id = '${m.guild.id}'`)

        m.message.reply(this.bot.locale.category("competition", "channel_set")).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Post competition info.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function info(m) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.competition_main|null} */
        let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${m.guild.id}'`)).results[0];

        if(resultMain == null || resultMain.channel_id == null) {
            m.message.reply(this.bot.locale.category("competition", "info_inactive")).catch(logger.error);
            return;
        }

        m.channel.send({ embed:getEmbedInfo.bind(this)(resultMain.channel_id) }).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Post competition status.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function status(m) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.competition_main|null} */
        let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${m.guild.id}'`)).results[0];
        m.channel.send({ embed:getEmbedStatus.bind(this)(m.guild, resultMain) }).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Start a new competition.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {number} startTime
 * @param {number} endTime
 */
function start(m, startTime, endTime) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.competition_main|null} */
        let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${m.guild.id}'
            FOR UPDATE`)).results[0];

        if(resultMain && resultMain.time_start != null) {
            await m.message.reply(this.bot.locale.category("competition", "already_started"));
            return;
        }

        if(!resultMain || resultMain.channel_id == null) {
            await m.message.reply(this.bot.locale.category("competition", "no_channel"));
            return;
        }

        let channel = m.guild.channels.resolve(resultMain.channel_id);
        if(!channel || !(channel instanceof Discord.TextChannel)) {
            await m.message.reply(this.bot.locale.category("competition", "channel_no_access"));
            return;
        }

        await query(`UPDATE competition_main SET time_start = '${startTime}', time_end = '${endTime}'
            WHERE guild_id = '${m.guild.id}'`);

        channel.send(this.bot.locale.category("competition", "start_message")).catch(logger.error);
        m.message.reply(this.bot.locale.category("competition", "start_success")).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Clear the current competition.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function destroy(m) {
    this.bot.sql.transaction(async query => {
        await query(`SELECT * FROM competition_main WHERE guild_id = '${m.guild.id}' FOR UPDATE`);

        await query(`DELETE FROM competition_messages WHERE guild_id = '${m.guild.id}'`);
        await query(`UPDATE competition_main SET time_start = NULL, time_end = NULL WHERE guild_id = '${m.guild.id}'`);
        await query(`DELETE FROM competition_maps WHERE guild_id = '${m.guild.id}'`);

        m.message.reply(this.bot.locale.category("competition", "erased")).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Add or delete a map from the current competition.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'remove-map'|'add-map'} type
 * @param {string} game
 * @param {KCGameMapManager.MapScoreQueryData} msqd
 * @param {KCGameMapManager} kcgmm
 */
function addMap(m, type, game, msqd, kcgmm) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.competition_main|null} */
        let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${m.guild.id}'`)).results[0];

        if(!resultMain || !resultMain.channel_id) {
            await m.message.reply(this.bot.locale.category("competition", "no_channel"));
            return;
        }
        if(resultMain.time_start == null) {
            await m.message.reply(this.bot.locale.category("competition", "addmap_not_started"));
            return;
        }

        const sqlWhere = `WHERE guild_id = '${m.guild.id}'
        AND game = '${game}'
        AND type = '${msqd.type}'
        AND map_id ${msqd.id == null ? 'IS NULL' : `= '${msqd.id}'`}
        AND size ${msqd.size == null ? 'IS NULL' : `= '${msqd.size}'`}
        AND complexity ${msqd.complexity == null ? 'IS NULL' : `= '${msqd.complexity}'`}
        AND name ${msqd.name == null ? 'IS NULL' : `= '${msqd.name}'`}`;

        switch(type) {
        case "remove-map":
            /** @type {Db.competition_maps[]} */
            var resultsMaps = (await query(`SELECT * FROM competition_maps ${sqlWhere}`)).results;

            console.log(resultsMaps, `SELECT * FROM competition_maps ${sqlWhere}`);

            if(resultsMaps.length <= 0) {
                await m.message.reply(this.bot.locale.category("competition", "removemap_not_added"));
                return;
            }

            await query(`DELETE FROM competition_maps ${sqlWhere}`);
            
            await m.message.reply(this.bot.locale.category("competition", "removemap_success"));
            break;
        case "add-map":
        default:
            /** @type {Db.competition_maps[]} */
            var resultsMaps = (await query(`SELECT * FROM competition_maps ${sqlWhere}`)).results;
            if(resultsMaps.length > 0) {
                await m.message.reply(this.bot.locale.category("competition", "addmap_already_added"));
                return;
            }

            /** @type {Db.competition_history_maps[]} */
            var resultsHistoryMaps = (await query(`SELECT * FROM competition_history_maps chm JOIN competition_history_competitions chc ON chc.id = chm.id_competition_history_competitions
                WHERE chc.guild_id = '${m.guild.id}'
                AND chm.game = '${game}'
                AND chm.type = '${msqd.type}'
                AND chm.map_id ${msqd.id == null ? 'IS NULL' : `= '${msqd.id}'`}
                AND chm.size ${msqd.size == null ? 'IS NULL' : `= '${msqd.size}'`}
                AND chm.complexity ${msqd.complexity == null ? 'IS NULL' : `= '${msqd.complexity}'`}
                AND chm.name ${msqd.name == null ? 'IS NULL' : `= '${msqd.name}'`}`)).results;
            if(resultsHistoryMaps.length > 0) {
                await m.message.reply(this.bot.locale.category("competition", "addmap_already_in_history"));
                return;
            }

            await query(`INSERT INTO competition_maps (guild_id, game, type, map_id, size, complexity, name)
                VALUES('${m.guild.id}', '${game}', '${msqd.type}', 
                    ${msqd.id == null ? 'NULL' : `'${msqd.id}'`}, 
                    ${msqd.size == null ? 'NULL' : `'${msqd.size}'`}, 
                    ${msqd.complexity == null ? 'NULL' : `'${msqd.complexity}'`}, 
                    ${msqd.name == null ? 'NULL' : `'${msqd.name}'`}
                )`);

            await m.message.reply(this.bot.locale.category("competition", "addmap_success"));
            break;
        }
    }).then(() => {
        this.loop(m.guild, kcgmm);
    }).catch(logger.error);
}

/**
 * Force update the scores.
 * @this {Competition}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {KCGameMapManager} kcgmm
 */
function update(m, kcgmm) {
    this.loop(m.guild, kcgmm).then(() => {
        m.message.reply(this.bot.locale.category("competition", "scores_updated")).catch(logger.error);
    }).catch(e => {
        m.message.reply(this.bot.locale.category("competition", "score_update_failed")).catch(logger.error);
        logger.error(e);
    });
    
}

/**
 * Rebuild the competition tally.
 * @this Competition
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function buildTally(m) {
    this.bot.sql.transaction(async query => {
        await buildScoreTally.bind(this)(m.guild, m.channel, query);
    }).catch(logger.error);
}

/**
 * End the current competition, save it to history, tally up scores and post all related messages.
 * @this Competition
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {KCGameMapManager} kcgmm
 */
function end(m, kcgmm) {
    const now = Date.now();

    this.bot.sql.transaction(async query => {
        await query(`SELECT * FROM competition_main WHERE guild_id = '${m.guild.id}' FOR UPDATE`);

        await m.message.reply(this.bot.locale.category("competition", "end_in_progress"));

        /** @type {Object.<string, string>} */
        let emotes = {};
        await this.bot.sql.transaction(async query => {
            /** @type {any[]} */
            let results = (await query(`SELECT * FROM emotes_game
                                       WHERE guild_id = '${m.guild.id}'`)).results;
            emotes = results.reduce((a, v) => { a[v.game] = v.emote; return a; }, {});
        }).catch(logger.error);

        /** @type {Db.competition_main|null} */
        let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${m.guild.id}'`)).results[0];
        /** @type {Db.competition_maps[]} */
        let resultsMaps = (await query(`SELECT * FROM competition_maps WHERE guild_id = '${m.guild.id}'`)).results;

        if(!resultMain || resultMain.channel_id == null) {
            await m.message.reply(this.bot.locale.category("competition", "no_channel"));
            return;
        }
        const channel = m.guild.channels.resolve(resultMain.channel_id);
        if(!channel || !(channel instanceof Discord.TextChannel)) {
            await m.message.reply(this.bot.locale.category("competition", "channel_no_access"));
            return;
        }
        if(!resultMain.time_start) {
            await m.message.reply(this.bot.locale.category("competition", "not_running"));
            return;
        }
        if(resultsMaps.length <= 0) {
            await m.message.reply(this.bot.locale.category("competition", "cant_end_no_maps"));
            return;
        }

        await this.loop(m.guild, kcgmm);

        await Bot.Util.Promise.sleep(1000);
        await channel.send(this.bot.locale.category("competition", "end_channel_ended"));

        /** @type {Discord.Collection<Db.competition_maps, KCGameMapManager.MapLeaderboard>} */
        const maps = new Discord.Collection();

        //Ensure proper order of messages.
        resultsMaps.sort((a, b) => this.games.indexOf(a.game) - this.games.indexOf(b.game));
        for(let resultMaps of resultsMaps) {
            let map = getMapScoreQueryDataFromDatabase(resultMaps);

            const fullMapLeaderboard = await kcgmm.getMapScores(map, "specialevent");
            const registeredMapLeaderboard = await getMapLeaderboardWithOnlyRegisteredUsers.bind(this)(query, m.guild, map.game, fullMapLeaderboard);
            
            maps.set(resultMaps, registeredMapLeaderboard);
            
            const mapList = kcgmm.getMapListId(map.game);
            const mapData = !mapList || map.id == null ? undefined : mapList.get(map.id);

            const embed = getEmbedTemplate();
            const field = await getEmbedFieldFromMapData(m.guild, this.bot.locale, registeredMapLeaderboard, map, emotes[map.game], mapData);
            embed.title = field.name;
            embed.description = field.value;
            embed.footer = {
                text: Bot.Util.getFormattedDate(resultMain.time_start || 0, true) + " - " + Bot.Util.getFormattedDate(now, true),
            }
            
            await channel.send({embed: embed});
        }

        let insertComps = (await query(`INSERT INTO competition_history_competitions (guild_id, time_end)
            VALUES ('${m.guild.id}', '${now}')`)).results;

        for(let map of maps.keys()) {
            let insertMaps = (await query(`INSERT INTO competition_history_maps (id_competition_history_competitions, game, type, map_id, size, complexity, name)
            VALUES ('${insertComps.insertId}', '${map.game}', '${map.type}',
            ${map.map_id ? `'${map.map_id}'` : 'NULL'},
            ${map.size ? `'${map.size}'` : 'NULL'},
            ${map.complexity ? `'${map.complexity}'` : 'NULL'},
            ${map.name ? `'${map.name}'` : 'NULL'})`)).results;

            let scores = /** @type {KCGameMapManager.MapLeaderboard} */(maps.get(map));
            for(let score of scores.entries) {
                let insertScores = (await query(`INSERT INTO competition_history_scores (id_competition_history_maps, user_rank, user_id, time, plays, score)
                VALUES ('${insertMaps.insertId}', '${score.rank}', '${score.user}', '${score.time}', '${score.plays}', ${score.score ? `'${score.score}'` : 'NULL'})`)).results;
            }
        }

        await query(`DELETE FROM competition_messages WHERE guild_id = '${m.guild.id}'`);
        await query(`UPDATE competition_main SET time_start = NULL, time_end = NULL WHERE guild_id = '${m.guild.id}'`);
        await query(`DELETE FROM competition_maps WHERE guild_id = '${m.guild.id}'`);

        await m.message.reply(this.bot.locale.category("competition", "end_success"));
        await buildScoreTally.bind(this)(m.guild, channel, query);
    }).catch(logger.error);
}

/**
 * Get a random map that has not been featured yet in a previous competition.
 * @this Competition
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {KCGameMapManager} kcgmm
 * @param {string} game
 * @param {import('./Map.js').default} map
 */
function map(m, kcgmm, game, map) {
    this.bot.sql.transaction(async query => {
        let mapList = kcgmm.getMapListId(game);
        if(!mapList) {
            m.channel.send(this.bot.locale.category('competition', 'game_not_supported')).catch(logger.error);
            return;
        }

        /** @type {Db.competition_history_maps[]} */
        let resultsMaps = (await query(`SELECT * FROM competition_history_maps chm 
            JOIN competition_history_competitions chc ON chc.id = chm.id_competition_history_competitions
            WHERE chc.guild_id = '${m.guild.id}'
            AND chm.game = '${game}'
            AND chm.type = 'custom'`)).results;

        for(let resultMaps of resultsMaps) {
            if(resultMaps.map_id) mapList.delete(resultMaps.map_id);
        }

        let arr = [...mapList.keys()];
        let id = arr[Bot.Util.getRandomInt(0, arr.length)];

        let err = map.land(m, [`${game}`, `${id}`], `${game} ${id}`, { action: 'map', kcgmm: kcgmm });
        if(err) m.channel.send(err).catch(logger.error);
    }).catch(logger.error);
}






/**
 * @this Competition
 * @param {Discord.Guild} guild 
 * @param {Discord.TextChannel} channel
 * @param {SQLWrapper.Query} query
 * @returns {Promise<Discord.Message>}
 */
async function buildScoreTally(guild, channel, query) {
    const roleId = this.bot.getRoleId(guild.id, "CHAMPION_OF_KC");
    const role = roleId ? guild.roles.cache.get(roleId) : undefined;

    /** @type {Discord.Collection<Discord.Snowflake, number>} */
    const champions = new Discord.Collection();

    let weeks = 2;
    let i = 1;

    /** @type {Db.competition_history_competitions[]} */
    let resultsComps = (await query(`SELECT * FROM competition_history_competitions WHERE guild_id = '${guild.id}'`)).results;
    
    resultsComps = resultsComps.slice(resultsComps.length - weeks, resultsComps.length);
    
    for(let resultComps of resultsComps) {
        /** @type {Db.competition_history_maps[]} */
        let resultsMaps = (await query(`SELECT * FROM competition_history_maps 
            WHERE id_competition_history_competitions = '${resultComps.id}'`)).results;

        for(let resultMaps of resultsMaps) {
            /** @type {Db.competition_history_scores[]} */
            let resultsScores = (await query(`SELECT * FROM competition_history_scores 
                WHERE id_competition_history_maps = '${resultMaps.id}'`)).results;

            for(let resultScores of resultsScores) {
                if(resultScores.user_rank !== 1) continue;
                
                champions.set(resultScores.user_id, i);
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
            let member = await guild.members.fetch(snowflake).catch(() => {});
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
 * @param {Db.competition_main|null} resultMain
 * @returns {Discord.MessageEmbed}
 */
function getEmbedStatus(guild, resultMain) {
    const locale = this.bot.locale;

    let embed = new Discord.MessageEmbed({
        color: 1146986,
        title: this.bot.locale.category("competition", "status_title"),
        description: ""
    });
    embed.fields = [];

    embed.description += "Channel: "; 
    if(resultMain && resultMain.channel_id != null) {
        let channel = guild.channels.resolve(resultMain.channel_id);
        embed.description += channel ? "<#" + channel.id + ">" : "no access";
    }
    else embed.description += "unset";
    
    embed.description += "\n";
    embed.description += "Status: ";
    if(resultMain) {
        embed.description += resultMain.time_start ? "Started " + Bot.Util.getFormattedDate(resultMain.time_start, true) : "Not started";
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
            text: "Time left: " + (timeRemaining > 0 ? Bot.Util.getFormattedTimeRemaining(timeRemaining) : "OVERTIME")
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

        /** @type {void|Discord.GuildMember} */
        let member = await guild.members.fetch(entry.user).catch(() => {});

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
 * @param {SQLWrapper.Query} query
 * @param {Discord.Guild} guild
 * @param {string} game
 * @param {KCGameMapManager.MapLeaderboard} mapLeaderboard 
 * @returns {Promise<KCGameMapManager.MapLeaderboard>} New leaderboard without users that haven't registered on Discord.
 */
async function getMapLeaderboardWithOnlyRegisteredUsers(query, guild, game, mapLeaderboard) {
    /** @type {KCGameMapManager.MapLeaderboard} */
    const newLeaderboard = { ...mapLeaderboard }
    newLeaderboard.entries = [];

    let rank = 1;
    for(let entry of mapLeaderboard.entries) {
        /** @type {Db.competition_register} */
        let resultRegister = (await query(`SELECT * FROM competition_register 
            WHERE guild_id = '${guild.id}' AND user_name = '${entry.user}'`)).results[0];
        if(resultRegister == null) continue;

        /** @type {void|Discord.GuildMember} */
        let member = await guild.members.fetch(resultRegister.user_id).catch(() => {});

        if(member == null) continue;

        let newEntry = { ...entry };
        newEntry.user = member.id;
        newEntry.rank = rank;
        rank++;

        newLeaderboard.entries.push(newEntry);
    }

    return newLeaderboard;
};

/**
 * @param {Db.competition_maps|Db.competition_history_maps} resultMaps
 * @returns {KCGameMapManager.MapScoreQueryData}
 */
function getMapScoreQueryDataFromDatabase(resultMaps) {
    return {
        game: resultMaps.game,
        type: resultMaps.type,
        id: resultMaps.map_id ?? undefined,
        size: resultMaps.size ?? undefined,
        complexity: resultMaps.complexity ?? undefined,
        name: resultMaps.name ?? undefined
    }
}