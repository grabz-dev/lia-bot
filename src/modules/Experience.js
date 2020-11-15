'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */

/**
 * @typedef {object} Experience.ExpData
 * @property {number} currentXP
 * @property {number} maxXP
 * @property {number} currentLevel
 */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';

export default class Experience extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        //https://knucklecracker.com/creeperworld4/plqueryDEMO.php?gameUID=demobonus4
        //KCGameMapManager.getScoreQueryURL
        this.games = ['pf', 'cw3', 'cw2'];
        this.expBarLength = 15;
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);

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
        }).then(() => {
            /** @type {any[]} */
            var documents;
            this.bot.tdb.session(guild, 'experience', async session => {
                documents = await this.bot.tdb.find(session, guild, 'experience', 'data', {}, {}, {});
            }).then(() => {
                this.bot.sql.transaction(async query => {
                    for(let document of documents) {
                        /** @type {any[]} */
                        let resultsUsers = (await query(`SELECT * FROM experience_users
                                                    WHERE user_id = '${document.u}' AND game = '${document.g}'`)).results;
                        if(resultsUsers.length <= 0) {
                            await query(`INSERT INTO experience_users (user_id, user_name, game, maps_current)
                                         VALUES ('${document.u}', '${document.n}', '${document.g}', '${JSON.stringify(document.cc.cur)}')`);

                            resultsUsers = (await query(`SELECT * FROM experience_users
                                                         WHERE user_id = '${document.u}' AND game = '${document.g}'`)).results;
                        }



                        for(let i = 0; i < document.cc.fin.length; i++) {
                            let id = document.cc.fin[i];

                            /** @type {any[]} */
                            let results = (await query(`SELECT * FROM experience_maps em
                                                        JOIN experience_users eu ON eu.id = em.id_experience_users
                                                        WHERE eu.user_id = '${document.u}' 
                                                            AND eu.game = '${document.g}'
                                                            AND em.map_id = '${id}'`)).results;
                            if(results.length <= 0) {
                                await query(`INSERT INTO experience_maps (id_experience_users, map_id)
                                             VALUES ('${resultsUsers[0].id}', '${id}')`);
                            } 
                        }
                    }
                }).catch(logger.error);
            }).catch(logger.error);
        }).catch(logger.error);
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
            /** @type {any[]} */
            let resultsUsers = (await query(`SELECT * FROM experience_users
                                             WHERE game = '${game}'`)).results;

            if(resultsUsers.length <= 0) {
                m.channel.send(this.bot.locale.category('experience', 'leaderboard_empty')).catch(logger.error);
                return;
            }

            /** @type {{resultUser: any, total: number}[]} */
            let leaders = [];
            for(let resultUser of resultsUsers) {
                if(!m.guild.members.cache.get(resultUser.user_id)) continue;

                /** @type {any[]} */
                let resultsMaps = (await query(`SELECT * FROM experience_maps
                                                WHERE id_experience_users = '${resultUser.id}'`)).results;
                
                leaders.push({
                    resultUser: resultUser,
                    total: resultsMaps.length
                });
            }
            leaders.sort((a, b) => b.total - a.total);


            /** @type {any} */
            let resultUsers = (await query(`SELECT * FROM experience_users
                                             WHERE game = '${game}' and user_id = '${m.member.id}'`)).results[0];
            
            let emote = ':game_die:';
            await this.bot.sql.transaction(async query => {
                let result = (await query(`SELECT * FROM emotes_game
                                           WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
                if(result) emote = result.emote;
            }).catch(logger.error);

            let msgStr = emote + ' ' + this.bot.locale.category('experience', 'leaderboard_title', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown') + '\n\n';

            let selfFound = false;
            for(let i = 0; i < Math.min(10, leaders.length); i++) {
                let leader = leaders[i];

                switch(i) {
                    case 0: msgStr += ':first_place: '; break;
                    case 1: msgStr += ':second_place: '; break;
                    case 2: msgStr += ':third_place: '; break;
                    case 3: msgStr += ':chocolate_bar: '; break;
                    default: msgStr += ':small_blue_diamond: ';
                }

                let expData = getExpDataFromMapsBeaten(leader.total);
                msgStr += (i + 1) < 10 ? '  ' : '';
                msgStr += '`#' + (i + 1) + '` - ';
                msgStr += getFormattedXPBarString('', expData, this.expBarLength);
                msgStr += ' - <@' + leader.resultUser.user_id + '>\n';

                if(resultUsers && leader.resultUser.user_id === resultUsers.user_id)
                    selfFound = true;
            }

            if(resultUsers && !selfFound) {
                /** @type {any[]} */
                let resultsMaps = (await query(`SELECT * FROM experience_maps
                                                WHERE id_experience_users = '${resultUsers.id}'`)).results;

                msgStr += '\n:small_blue_diamond: ';

                let expData = getExpDataFromMapsBeaten(resultsMaps.length);
                msgStr += '`#' + (leaders.findIndex(v => v.resultUser.user_id === resultUsers.user_id) + 1) + '` - ';
                msgStr += getFormattedXPBarString('', expData, this.expBarLength);
                msgStr += ' - <@' + resultUsers.user_id + '>\n';
            }

            m.channel.send('...').then(message => {
                message.edit(msgStr).catch(logger.error);
            }).catch(logger.error);
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
        const kcgmm = ext.kcgmm;

        let embed = getEmbedTemplate(m.member);

        /** @type {Object.<string, number>} */
        let projection = {};
        for(let i = 0; i < this.games.length; i++)
            projection['game.' + this.games[i] + '.user.' + m.member.id] = 1;

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

            for(let game of this.games) {
                let field = {
                    name: '...',
                    value: '...',
                    inline: false,
                }

                /** @type {any} */
                let resultUsers = (await query(`SELECT * FROM experience_users
                                                WHERE user_id = '${m.member.id}' AND game = '${game}'`)).results[0];

                if(resultUsers == null) {
                    let expData = getExpDataFromMapsBeaten(0);
                    field.name = getFormattedXPBarString(emotes[game]||':game_die:', expData, this.expBarLength);

                    field.value = Bot.Util.getSpecialWhitespace(3);
                    field.value += this.bot.locale.category('experience', 'embed_not_registered_1', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown');
                    field.value = Bot.Util.getSpecialWhitespace(3);
                    field.value += this.bot.locale.category('experience', 'embed_not_registered_2', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown');
                }
                else {
                    /** @type {any[]} */
                    let resultsMaps = (await query(`SELECT * FROM experience_maps
                                                    WHERE id_experience_users = '${resultUsers.id}'`)).results;

                    let expData = getExpDataFromMapsBeaten(resultsMaps.length);
                    field.name = getFormattedXPBarString(emotes[game]||':game_die:', expData, this.expBarLength);

                    let mapsCurrent = JSON.parse(resultUsers.maps_current);

                    let finished = [];
                    let unfinished = [];
                    let completed = [];
                    for(let id of mapsCurrent)
                        completed.push(kcgmm.getMapCompleted({game: game, type: 'custom', id: id}, resultUsers.user_name));
                    for(let i = 0; i < completed.length; i++) {
                        completed[i] = await completed[i];
                        completed[i] ? finished.push(mapsCurrent[i]) : unfinished.push(mapsCurrent[i]);
                    }

                    let str = '';
                    str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_1');
                    for(let j = 0; j < unfinished.length; j++)
                        str += '`#' + unfinished[j] + '` ';
                    str += '\n';

                    str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_2');            
                    for(let j = 0; j < finished.length; j++)
                        str += '`#' + finished[j] + '` ';

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

            /** @type {any} */
            let resultUsers = (await query(`SELECT * FROM experience_users
                                            WHERE user_id = '${m.member.id}' AND game = '${game}'`)).results[0];
            if(resultUsers == null) {
                m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            let mapsCurrent = JSON.parse(resultUsers.maps_current);

            /** @type {any[]} */
            let resultsMaps = (await query(`SELECT * FROM experience_maps
                                            WHERE id_experience_users = '${resultUsers.id}'`)).results;

            let expDataOld = getExpDataFromMapsBeaten(resultsMaps.length);
            let xpOld = getFormattedXPBarString(null, expDataOld, this.expBarLength, true);

            //Find out which maps from current maps are completed.
            let newlyFinishedMaps = [];
            { let promises = [];
            for(let i = 0; i < mapsCurrent.length; i++)
                promises[i] = ext.kcgmm.getMapCompleted({game: game, type: 'custom', id: mapsCurrent[i]}, resultUsers.user_name);
            for(let i = 0; i < promises.length; i++) {
                promises[i] = await promises[i];
                let id = mapsCurrent[i];
                //Find which maps generated last time were completed.
                //Add them to the finished maps array.
                
                if(promises[i] && !resultsMaps.find(v => v.map_id === id)) {
                    newlyFinishedMaps.push(id);
                }
            } }

            //Get the array of every map in the game. Removed maps do not exist in this array.
            let mapListArray = ext.kcgmm.getMapListArray(game);
            let mapListByIds = ext.kcgmm.getMapListId(game);
            if(mapListArray == null || mapListByIds == null) {
                m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            //Random an index from the array.
            //Save the ID of the selected map then remove the element from the array to not roll duplicates.
            let selectedIds = [];
            while(selectedIds.length < 5 && mapListArray.length > 0) {
                let index = Bot.Util.getRandomInt(1, mapListArray.length);
                let map = mapListArray[index];

                //Remove element from the array to indicate we have processed this map.
                mapListArray.splice(index, 1);

                //If the map no longer exists (for example it was deleted from the database) don't include it.
                if(!map)
                    continue;
                    
                //If we've already finished this map, don't include it.
                if(resultsMaps.find(v => v.map_id === map.id))
                    continue;
                
                selectedIds.push(map.id);
            }

            await query(`UPDATE experience_users SET maps_current = '${JSON.stringify(selectedIds)}'
                         WHERE user_id = '${m.member.id}' AND game = '${game}'`);
            for(let id of newlyFinishedMaps) {
                await query(`INSERT INTO experience_maps (id_experience_users, map_id)
                             VALUES ('${resultUsers.id}', '${id}')`);
            }
            
            let embed = getEmbedTemplate(m.member);
            embed.fields = [];

            let expDataNew = getExpDataFromMapsBeaten(resultsMaps.length + newlyFinishedMaps.length);

            let finished = [];
            let unfinished = [];

            { let promises = [];
            for(let i = 0; i < selectedIds.length; i++)
                promises[i] = ext.kcgmm.getMapCompleted({game: game, type: 'custom', id: selectedIds[i]}, resultUsers.user_name);
            for(let i = 0; i < promises.length; i++) {
                promises[i] = await promises[i];
                let id = selectedIds[i];
                promises[i] ? finished.push(selectedIds[i]) : unfinished.push(selectedIds[i]);
            } }

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
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_2', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'),
                value: Bot.Util.getSpecialWhitespace(3),
                inline: false
            };
            for(let j = 0; j < unfinished.length; j++)
                fieldNewMaps.value += '`#' + unfinished[j] + '` ';

            let fieldBeatenMaps = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_3'),
                value: Bot.Util.getSpecialWhitespace(1),
                inline: false,
            }
            for(let j = 0; j < finished.length; j++)
                fieldBeatenMaps.value += '`#' + finished[j] + '` ';

            let fieldInstructions = {
                name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
                value: this.bot.locale.category('experience', 'embed_results_value', game),
                inline: false
            }

            if(finished.length > 0)
                fieldBeatenMaps.value += '\n' + Bot.Util.getSpecialWhitespace(1)
            else
                fieldNewMaps.value += '\n' + Bot.Util.getSpecialWhitespace(1)

            embed.fields.push(fieldXp);
            embed.fields.push(fieldNewMaps);
            if(finished.length > 0)
                embed.fields.push(fieldBeatenMaps);
            embed.fields.push(fieldInstructions);

            m.channel.send({ embed:embed }).catch(logger.error);
        }).catch(logger.error);
    }
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
 * 
 * @param {number} number - The number of maps beaten.
 * @returns {Experience.ExpData}
 */
function getExpDataFromMapsBeaten(number) {
    let xp = number * 100; //100 XP per map completed.
    let level = 1;
    let xpToNextLevel = 500; //500 XP to level 2.
    let xpIncreasePerLevel = 200;

    while(true) {
        if(xp - xpToNextLevel < 0)
            break;

        xp = xp - xpToNextLevel;
        level += 1;
        xpToNextLevel += xpIncreasePerLevel;
    }

    return {
        currentXP: xp,
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
        color: 5555924,
    });
    if(member) {
        embed.author = {
            name: member.user.username + '#' + member.user.discriminator,
            iconURL: member.user.avatarURL() || member.user.defaultAvatarURL
        }
    }
    return embed;
}