'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */

/**
 * @typedef {object} Experience.ExpData
 * @property {number} currentXP
 * @property {number} maxXP
 * @property {number} currentLevel
 */


/**
 * @typedef {object} Db.experience_users
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} user_id
 * @property {string} user_name
 * @property {string} game
 * @property {string} maps_current
 */

/**
 * @typedef {object} Db.experience_maps
 * @property {number} id - Primary key
 * @property {number} id_experience_users - Db.experience_users key
 * @property {number} map_id
 */


import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import seedrandom from 'seedrandom';
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

export default class Experience extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        //https://knucklecracker.com/creeperworld4/plqueryDEMO.php?gameUID=demobonus4
        //KCGameMapManager.getScoreQueryURL
        this.games = ['cw4', 'pf', 'cw3', 'cw2'];
        this.expBarLength = 15;

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS experience_users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                user_name VARCHAR(128) NOT NULL,
                game VARCHAR(16) NOT NULL,
                maps_current JSON NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                map_id MEDIUMINT UNSIGNED NOT NULL
             )`);
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
    * Module Function: Show info about the experience system.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call
    * @param {KCGameMapManager} ext.kcgmm 
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    info(m, args, arg, ext) {
        if(this.games.includes(KCLocaleManager.getPrimaryAliasFromAlias('game', arg)||'')) {
            return this.get(m, args, arg, ext);
        }
        else if(arg.length > 0) return;

        const embed = getEmbedTemplate();

        embed.title = this.bot.locale.category('experience', 'intro_name');
        embed.description = this.bot.locale.category('experience', 'intro_value');

        m.channel.send({ embed: embed }).catch(logger.error);
    }

    /**
    * Module Function: Wipe a user's experience data for a specific game.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    wipe(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        let argSnowflake = args[1];
        if(argSnowflake == null)
            return this.bot.locale.category('experience', 'err_user_mention_not_provided');

        let snowflake = Bot.Util.getSnowflakeFromDiscordPing(argSnowflake);
        if(snowflake == null) {
            return this.bot.locale.category('experience', 'err_user_mention_not_correct');
        }
        let id = snowflake;

        this.bot.sql.transaction(async query => {
            /** @type {any} */
            var resultUsers = (await query(`SELECT * FROM experience_users
                                            WHERE game = '${game}' AND user_id = '${id}'`)).results[0];

            if(!resultUsers) {
                m.message.reply(this.bot.locale.category('experience', 'wipe_failed_not_registered')).catch(logger.error);
                return;
            }

            await query(`DELETE FROM experience_users
                         WHERE game = '${game}' AND user_id = '${id}'`);
            await query (`DELETE FROM experience_maps
                          WHERE id_experience_users = '${resultUsers.id}'`);
            
            m.channel.send(this.bot.locale.category('experience', 'wipe_successful')).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Register the user for the experience system.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    register(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        while(arg[0] === ' ')
            arg = arg.substring(1);
        if(arg.indexOf(' ') < 0)
            return this.bot.locale.category('experience', 'err_leaderboard_name_not_provided');
        
        arg = arg.substring(arg.indexOf(' ') + 1);

        let name = arg;

        this.bot.sql.transaction(async query => {
            /** @type {any} */
            var resultUsers = (await query(`SELECT * FROM experience_users
                                            WHERE game = '${game}' AND user_id = '${m.member.id}' AND user_name = '${name}'`)).results[0];
            if(resultUsers != null) {
                m.message.reply(this.bot.locale.category('experience', 'already_registered_with_this_name', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            /** @type {any} */
            var resultUsers = (await query(`SELECT * FROM experience_users
                                            WHERE game = '${game}' AND user_name = '${name}'`)).results[0];
            if(resultUsers != null) {
                m.message.reply(this.bot.locale.category('experience', 'name_taken', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            /** @type {any} */
            var resultUsers = (await query(`SELECT * FROM experience_users
                                            WHERE game = '${game}' AND user_id = '${m.member.id}'`)).results[0];
            if(resultUsers != null) {
                m.message.reply(this.bot.locale.category('experience', 'already_registered_with_other_name', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            if(this.cache.get(m.guild.id, 'pendingRegistration.' + m.guild.id) === name) {
                await query(`INSERT INTO experience_users (user_id, user_name, game, maps_current)
                             VALUES ('${m.member.id}', '${name}', '${game}', '[]')`);

                m.message.reply(this.bot.locale.category('experience', 'register_success', name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown', game)).catch(logger.error);
            }
            else {
                this.cache.set(m.guild.id, 'pendingRegistration.' + m.guild.id, name);
                m.message.reply(this.bot.locale.category('experience', 'register_confirm', name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            }
        }).catch(logger.error);
    }

    /**
    * Module Function: Show the experience leaderboards.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    leaderboard(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        this.bot.sql.transaction(async query => {
            const mapListId = ext.kcgmm.getMapListId(game);
            if(mapListId == null) {
                m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            /** @type {any[]} */
            let resultsUsers = (await query(`SELECT * FROM experience_users
                                             WHERE game = '${game}'`)).results;

            if(resultsUsers.length <= 0) {
                m.channel.send(this.bot.locale.category('experience', 'leaderboard_empty')).catch(logger.error);
                return;
            }

            /** @type {{resultUser: Db.experience_users, total: Experience.ExpData}[]} */
            let leaders = [];
            for(let resultUser of resultsUsers) {
                if(!m.guild.members.cache.get(resultUser.user_id)) continue;

                /** @type {any[]} */
                let resultsMaps = (await query(`SELECT * FROM experience_maps
                                                WHERE id_experience_users = '${resultUser.id}'`)).results;
                
                leaders.push({
                    resultUser: resultUser,
                    total: getExpDataFromMapsBeaten(getMapsParsed(mapListId, resultsMaps), ext.kcgmm)
                });
            }
            leaders.sort((a, b) => b.total.currentLevel - a.total.currentLevel || b.total.currentXP - a.total.currentXP);


            /** @type {any} */
            let resultUsers = (await query(`SELECT * FROM experience_users
                                             WHERE game = '${game}' and user_id = '${m.member.id}'`)).results[0];
            
            let emote = ':game_die:';
            await this.bot.sql.transaction(async query => {
                let result = (await query(`SELECT * FROM emotes_game
                                           WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
                if(result) emote = result.emote;
            }).catch(logger.error);


            let embed = getEmbedTemplate(m.member);
            embed.color = KCUtil.gameEmbedColors[game];
            embed.description = `${emote} ${this.bot.locale.category('experience', 'leaderboard_title', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')}\n`;
            let msgStr = '';

            let selfFound = false;
            for(let i = 0; i < Math.min(9, leaders.length); i++) {
                let leader = leaders[i];

                switch(i) {
                    case 0: msgStr += '🥇 '; break;
                    case 1: msgStr += '🥈 '; break;
                    case 2: msgStr += '🥉 '; break;
                    case 3: msgStr += '🍫 '; break;
                    default: msgStr += '🍬 ';
                }

                let member = m.guild.members.resolve(leader.resultUser.user_id);

                msgStr += `\`#${i+1}\``;
                msgStr += getFormattedXPBarString('', leader.total, this.expBarLength);
                msgStr += ` ${member ? member.nickname ?? member.user.username : leader.resultUser.user_name}\n`;

                if(resultUsers && leader.resultUser.user_id === resultUsers.user_id)
                    selfFound = true;
            }

            if(resultUsers && !selfFound) {
                /** @type {any[]} */
                let resultsMaps = (await query(`SELECT * FROM experience_maps
                                                WHERE id_experience_users = '${resultUsers.id}'`)).results;

                msgStr += '\n:small_blue_diamond: ';

                let expData = getExpDataFromMapsBeaten(getMapsParsed(mapListId, resultsMaps), ext.kcgmm);

                msgStr += `\`#${leaders.findIndex(v => v.resultUser.user_id === resultUsers.user_id)+1}\``;
                msgStr += getFormattedXPBarString('', expData, this.expBarLength);
                msgStr += ` ${m.member.nickname ?? m.member.user.username}\n`;
            }
            embed.description += msgStr;
            m.channel.send({embed: embed}).catch(logger.error);
        });
    }

    /**
    * Module Function: Show the user's experience breakdown for each game.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call
    * @param {KCGameMapManager} ext.kcgmm 
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    exp(m, args, arg, ext) {
        /** @type {string|undefined} */
        let game = args[0];
        if(game != null) {
            game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) ?? '';
            if(game.length === 0 || !this.games.includes(game))
                game = undefined;
        }

        let embed = getEmbedTemplate(m.member);

        this.bot.sql.transaction(async query => {
            embed.fields = [];

            /** @type {Object.<string, string>} */
            let emotes = {};
            await this.bot.sql.transaction(async query => {
                /** @type {any[]} */
                let results = (await query(`SELECT * FROM emotes_game
                                           WHERE guild_id = '${m.guild.id}'`)).results;
                emotes = results.reduce((a, v) => { a[v.game] = v.emote; return a; }, {});
            }).catch(logger.error);

            const games = game == null ? this.games : [game];
            if(games.length === 1)
                embed.color = KCUtil.gameEmbedColors[games[0]];

            for(let game of games) {
                const mapListId = ext.kcgmm.getMapListId(game);
                if(mapListId == null) continue;

                let field = {
                    name: '...',
                    value: '...',
                    inline: false,
                }

                /** @type {Db.experience_users} */
                let resultUsers = (await query(`SELECT * FROM experience_users
                                                WHERE user_id = '${m.member.id}' AND game = '${game}'`)).results[0];

                if(resultUsers == null) {
                    let expData = getExpDataFromMapsBeaten([], ext.kcgmm);
                    field.name = getFormattedXPBarString(emotes[game]||':game_die:', expData, this.expBarLength);

                    field.value = Bot.Util.getSpecialWhitespace(3);
                    field.value += this.bot.locale.category('experience', 'embed_not_registered_1', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown');
                    field.value = Bot.Util.getSpecialWhitespace(3);
                    field.value += this.bot.locale.category('experience', 'embed_not_registered_2', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown');
                }
                else {
                    /** @type {Db.experience_maps[]} */
                    let resultsMaps = (await query(`SELECT * FROM experience_maps
                    WHERE id_experience_users = '${resultUsers.id}'`)).results;

                    let expData = getExpDataFromMapsBeaten(getMapsParsed(mapListId, resultsMaps), ext.kcgmm);
                    field.name = getFormattedXPBarString(emotes[game]||':game_die:', expData, this.expBarLength);

                    
                    let mapsCurrent = getMapsParsed(mapListId, /** @type {number[]} */(JSON.parse(resultUsers.maps_current)));

                    let maps = await getMapsCompleted(mapsCurrent, resultUsers.user_name, ext.kcgmm);

                    let str = '';
                    str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_1');
                    str += ' ';
                    for(let j = 0; j < maps.unfinished.length; j++)
                        str += `\`#${maps.unfinished[j].id}\` `;
                    str += '\n';
                    str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_2');
                    str += ' ';      
                    for(let j = 0; j < maps.finished.length; j++)
                        str += `\`#${maps.finished[j].id}\` `;

                    field.value = str;
                    field.name += ' ' + resultUsers.user_name;
                }

                embed.fields.push(field);
            }

            embed.fields[embed.fields.length - 1].value += '\n' + Bot.Util.getSpecialWhitespace(1);

            embed.fields.push({
                name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
                value: this.bot.locale.category('experience', 'embed_instructions_value'),
                inline: false,
            });

            m.channel.send({ embed:embed }).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Award experience for completed maps and generate new maps to complete.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call
    * @param {KCGameMapManager} ext.kcgmm 
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    get(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        this.bot.sql.transaction(async query => {
            await query(`SELECT maps_current FROM experience_users
                         WHERE user_id = '${m.member.id}' AND game = '${game}'
                         FOR UPDATE`);

            let emote = ':game_die:';
            await this.bot.sql.transaction(async query => {
                let result = (await query(`SELECT * FROM emotes_game
                                           WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
                if(result) emote = result.emote;
            }).catch(logger.error);

            /** @type {Db.experience_users} */
            let resultUsers = (await query(`SELECT * FROM experience_users
                                            WHERE user_id = '${m.member.id}' AND game = '${game}'`)).results[0];
            if(resultUsers == null) {
                m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            //Get the array of every map in the game. Removed maps do not exist in this array.
            let mapListArrayModified = ext.kcgmm.getMapListArray(game);
            const mapListId = ext.kcgmm.getMapListId(game);
            let mapListIdModified = ext.kcgmm.getMapListId(game);
            if(mapListArrayModified == null || mapListId == null || mapListIdModified == null) {
                m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            /** @type {Db.experience_maps[]} */
            let resultsMaps = (await query(`SELECT * FROM experience_maps
                                            WHERE id_experience_users = '${resultUsers.id}'`)).results;
            let oldMaps = getMapsParsed(mapListId, resultsMaps);
            let expDataOld = getExpDataFromMapsBeaten(oldMaps, ext.kcgmm);
            let xpOld = getFormattedXPBarString(null, expDataOld, this.expBarLength, true);

            let mapsChosenLast = getMapsParsed(mapListId, /** @type {number[]} */(JSON.parse(resultUsers.maps_current)));
            //Find out which maps from current maps are completed.
            let mapsCurrent = await getMapsCompleted(mapsChosenLast, resultUsers.user_name, ext.kcgmm);

            let allMapsCompleted = resultsMaps.map((v => v.map_id)).concat(mapsCurrent.finished.map(v => v.id));
            const maxMonthlyMaps = Math.min(3, Math.ceil(mapListArrayModified.length / 50));
            let mapListArrayByRankModified = ext.kcgmm.getHighestRankedMonthlyMaps(game, 3, allMapsCompleted);

            /** @type {KCGameMapManager.MapData[]} */
            let selectedIds = [];
            selectRandomMaps(selectedIds, mapListArrayByRankModified, mapsCurrent.finished, resultsMaps, 3);
            selectRandomMaps(selectedIds, mapListArrayModified, mapsCurrent.finished, resultsMaps, 6);

            await query(`UPDATE experience_users SET maps_current = '${JSON.stringify(selectedIds.map(v => v.id))}'
                         WHERE user_id = '${m.member.id}' AND game = '${game}'`);
            for(let mapData of mapsCurrent.finished) {
                await query(`INSERT INTO experience_maps (id_experience_users, map_id)
                             VALUES ('${resultUsers.id}', '${mapData.id}')`);
            }
            
            let embed = getEmbedTemplate(m.member);
            embed.color = KCUtil.gameEmbedColors[game];
            embed.description = `Your leaderboards name is \`${resultUsers.user_name}\``;
            
            embed.fields = [];

            let expDataNew = getExpDataFromMapsBeaten(oldMaps.concat(mapsCurrent.finished), ext.kcgmm);
            let maps = await getMapsCompleted(selectedIds, resultUsers.user_name, ext.kcgmm);

            let fieldXp = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_1'),
                value: Bot.Util.getSpecialWhitespace(1),
                inline: false
            }
            fieldXp.value = '```';
            fieldXp.value += xpOld + '\n';
            fieldXp.value += '↓                   ↓  ↓                   ↓\n';
            fieldXp.value += getFormattedXPBarString(null, expDataNew, this.expBarLength, true);
            fieldXp.value += '```';

            let fieldNewMaps = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_2', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown', KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${game}_custom`)),
                value: maps.unfinished.length <= 0 ? `${Bot.Util.getSpecialWhitespace(3)}You've completed everything. Well done!` : '',
                inline: false
            };
            for(let j = 0; j < maps.unfinished.length; j++)
                fieldNewMaps.value += getMapClaimString(maps.unfinished[j], game, ext.kcgmm) + '\n';

            let fieldBeatenMaps = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_3'),
                value: '',
                inline: false,
            }
            for(let j = 0; j < maps.finished.length; j++)
                fieldBeatenMaps.value += getMapClaimString(maps.finished[j], game, ext.kcgmm) + '\n';

            let fieldInstructions = {
                name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
                value: this.bot.locale.category('experience', 'embed_results_value', game),
                inline: false
            }

            if(maps.finished.length > 0)
                fieldBeatenMaps.value += '\n' + Bot.Util.getSpecialWhitespace(1)
            else
                fieldNewMaps.value += '\n' + Bot.Util.getSpecialWhitespace(1)

            embed.fields.push(fieldXp);
            embed.fields.push(fieldNewMaps);
            if(maps.finished.length > 0)
                embed.fields.push(fieldBeatenMaps);
            embed.fields.push(fieldInstructions);

            m.channel.send({ embed:embed }).catch(logger.error);
        }).catch(logger.error);
    }
}

/**
 * Select random maps that haven't been completed yet
 * @param {KCGameMapManager.MapData[]} arr - Array of maps to fill
 * @param {KCGameMapManager.MapData[]} maps - Maps to choose from. Will be mutated
 * @param {KCGameMapManager.MapData[]} mapsChosenLastCompleted - Maps chosen last time
 * @param {Db.experience_maps[]} resultsMaps - Already finished maps
 * @param {number} count - Amount of maps to pick
 */
function selectRandomMaps(arr, maps, mapsChosenLastCompleted, resultsMaps, count) {
    //Random an index from the array.
    //Save the ID of the selected map then remove the element from the array to not roll duplicates.
    while(arr.length < count && maps.length > 0) {
        let index = Bot.Util.getRandomInt(0, maps.length);
        let map = maps[index];

        //Remove element from the array to indicate we have processed this map.
        maps.splice(index, 1);

        //If the map no longer exists (for example it was deleted from the database) don't include it.
        if(!map)
            continue;
            
        //If we've already finished this map, don't include it.
        if(resultsMaps.find(v => v.map_id === map.id))
            continue;
        
        //If we've chosen this map last time, don't choose it again.
        if(mapsChosenLastCompleted.find(v => v.id === map.id))
            continue;

        //If we already added this map, don't include it.
        if(arr.indexOf(map) > -1)
            continue;
        
        arr.push(map);
    }
}

/**
 * 
 * @param {KCGameMapManager.MapData} map 
 * @param {string} game
 * @param {KCGameMapManager} kcgmm 
 * @returns {string}
 */
function getMapClaimString(map, game, kcgmm) {
    let str = `\`ID #${map.id}\`: ${getExpFromMap(map, kcgmm)} XP - ${map.title} __by ${map.author}__`;

    if(map.timestamp == null) return str;
    let date = kcgmm.getDateFlooredToMonth(new Date(map.timestamp));
    let month = KCUtil.getMonthFromDate(date, true);
    const rank = kcgmm.getMapMonthlyRank(map);
    if(rank == null) return str;

    return `${str} (#${rank} ${month} ${date.getFullYear()})`;
}

/**
 * 
 * @param {string | null} emote 
 * @param {Experience.ExpData} expData
 * @param {number} expBarsMax 
 * @param {boolean=} noCode 
 * @returns {string}
 */
function getFormattedXPBarString(emote, expData, expBarsMax, noCode) {
    let str = '';
    
    if(emote == null)
        str += '';
    else
        str += emote + ' ';
    if(!noCode)
        str += '`';
    str += 'LVL: ' + Bot.Util.String.fixedWidth(expData.currentLevel+'', 4, ' ', true);
    str += ' ';
    str += 'XP: ' + Bot.Util.String.fixedWidth(expData.currentXP+'', 5, ' ', false);
    str += '/' + Bot.Util.String.fixedWidth(expData.maxXP+'', 6, ' ', true);
    str += ' ';

    let expBarsToFill = Math.floor(expData.currentXP / expData.maxXP * expBarsMax);

    str += '|';
    for(let j = 0; j < expBarsToFill; j++)
    str += '#';
    for(let j = 0; j < expBarsMax - expBarsToFill; j++)
        str += ' ';
    str += '|';
    if(!noCode)
        str += '`';

    return str;
}

/**
 * @param {KCGameMapManager.MapData} mapData 
 * @param {KCGameMapManager} kcgmm
 * @returns {number}
 */
function getExpFromMap(mapData, kcgmm) {
    //const rng = seedrandom(mapData.id+'');
    //let value = Math.floor(((rng() / 2) + 0.75) * 100); //0.75 - 1.25
    let value = 100;

    if(!mapData.timestamp)
        return value;

    const rank = kcgmm.getMapMonthlyRank(mapData);
    if(rank == null)
        return value;

    return Math.max(value, value + 200 - ((rank-1) * 20)); 
    const multiplier = Math.max(1, (16 - rank) / 5);
    return Math.ceil(value * multiplier / 10) * 10;
}

/**
 * 
 * @param {KCGameMapManager.MapData[]} maps
 * @param {string} userName
 * @param {KCGameMapManager} kcgmm
 * @returns {Promise<{finished: KCGameMapManager.MapData[], unfinished: KCGameMapManager.MapData[]}>} 
 */
async function getMapsCompleted(maps, userName, kcgmm) {
    /** @type {KCGameMapManager.MapData[]} */
    let finished = [];
    /** @type {KCGameMapManager.MapData[]} */
    let unfinished = [];

    let promises = [];
    for(let i = 0; i < maps.length; i++)
        promises[i] = kcgmm.getMapCompleted({game: maps[i].game, type: 'custom', id: maps[i].id}, userName);
    for(let i = 0; i < promises.length; i++) {
        await promises[i] ? finished.push(maps[i]) : unfinished.push(maps[i]);
    }
    return {
        finished, unfinished
    }
}

/**
 * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId
 * @param {Db.experience_maps[]|number[]} arr
 * @returns {KCGameMapManager.MapData[]} 
 */
function getMapsParsed(mapListId, arr) {
    /** @type {KCGameMapManager.MapData[]} */
    let maps = [];
    for(let val of arr) {
        let map = mapListId.get(typeof val === 'number' ? val : val.map_id);
        if(map == null) continue;
        maps.push(map);
    }
    return maps;
}

/**
 * @param {KCGameMapManager.MapData[]} maps
 * @param {KCGameMapManager} kcgmm
 * @returns {Experience.ExpData}
 */
function getExpDataFromMapsBeaten(maps, kcgmm) {
    let level = 1;
    let xpToNextLevel = 600; //2000 XP to level 2.
    let xpIncreasePerLevel = 200;
    let totalXp = 0;

    for(let map of maps) {
        totalXp += getExpFromMap(map, kcgmm);
    }

    while(true) {
        if(totalXp - xpToNextLevel < 0)
            break;

        totalXp = totalXp - xpToNextLevel;
        level += 1;
        xpToNextLevel += xpIncreasePerLevel;
    }

    return {
        currentXP: totalXp,
        maxXP: xpToNextLevel,
        currentLevel: level
    }
}

/**
 * 
 * @param {Discord.GuildMember=} member 
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate(member) {
    let embed = new Discord.MessageEmbed({
        color: 5559447,
    });
    if(member) {
        embed.author = {
            name: member.user.username + '#' + member.user.discriminator,
            iconURL: member.user.avatarURL() || member.user.defaultAvatarURL
        }
    }
    return embed;
}