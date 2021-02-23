'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */

/**
 * @typedef {object} ExpData
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

/**
 * @typedef {object} Db.experience_maps_ignore
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
import { ETIME } from 'constants';

export default class Experience extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        this.games = ['cw4', 'pf', 'cw3', 'cw2'];
        this.expBarLength = 40;
        this.expBarLeadersLength = 26;
        this.dots = ['⣀', '⣄', '⣤', '⣦', '⣶', '⣷', '⣿']

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS experience_users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                user_name VARCHAR(128) BINARY NOT NULL,
                game VARCHAR(16) NOT NULL,
                maps_current JSON NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                map_id MEDIUMINT UNSIGNED NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps_ignore (
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
     * Module Function
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext
     * @param {'info'|'wipe'|'register'|'leaderboard'|'profile'|'new'|'ignore'|'unignore'|'ignorelist'} ext.action - Custom parameters provided to function call.
     * @param {KCGameMapManager} ext.kcgmm
     * @param {import('./Champion.js').default} ext.champion
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'register':
        case 'leaderboard':
        case 'new':
        case 'wipe':
        case 'ignore':
        case 'unignore':
        case 'ignorelist': {
            let game = args[0];
            if(game == null)
                return this.bot.locale.category('experience', 'err_game_name_not_provided');
            
            game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
            if(game.length === 0 || !this.games.includes(game))
                return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);
            
            switch(ext.action) {
            case 'register':
                while(arg[0] === ' ')
                arg = arg.substring(1);
                if(arg.indexOf(' ') < 0)
                    return this.bot.locale.category('experience', 'err_leaderboard_name_not_provided');

                arg = arg.substring(arg.indexOf(' ') + 1);

                register.call(this, m, game, arg);
                return;
            case 'leaderboard':
                leaderboard.call(this, m, game, ext.kcgmm);
                return;
            case 'new':
                newMaps.call(this, m, game, ext.kcgmm, (args[1]??'').toLowerCase().includes('dm'));
                return;
            case 'wipe':
                let argSnowflake = args[1];
                if(argSnowflake == null)
                    return this.bot.locale.category('experience', 'err_user_mention_not_provided');

                let snowflake = Bot.Util.getSnowflakeFromDiscordPing(argSnowflake);
                if(snowflake == null) {
                    return this.bot.locale.category('experience', 'err_user_mention_not_correct');
                }
                
                wipe.call(this, m, game, snowflake);
                return;
            case 'ignore':
            case 'unignore':
                let mapId = +args[1];
                if(!Number.isFinite(mapId)) {
                    return this.bot.locale.category('experience', 'err_map_id_invalid');
                }
                ext.action === 'ignore' ? ignore.call(this, m, game, mapId) : unignore.call(this, m, game, mapId);
                return;
            case 'ignorelist':
                ignorelist.call(this, m, game);
                return;
            }
        }
        case 'profile': {
            /** @type {string|undefined} */
            let game = args[0];
            if(game != null) {
                game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) ?? '';
                if(game.length === 0 || !this.games.includes(game))
                    game = undefined;
            }

            profile.call(this, m, game, ext.kcgmm, (args[0]??'').toLowerCase().includes('dm') || (args[1]??'').toLowerCase().includes('dm'));
            return;
        }
        case 'info': {
            if(this.games.includes(KCLocaleManager.getPrimaryAliasFromAlias('game', arg)||'')) {
                return this.land(m, args, arg, Object.assign(ext, { action: 'new' }));
            }
            else if(arg.length > 0) return;

            info.call(this, m);
            return;
        }
        }
    }
}

/**
 * Register the user for the experience system.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game
 * @param {string} name
 */
function register(m, game, name) {
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
 * Show the experience leaderboards.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game
 * @param {KCGameMapManager} kcgmm
 */
function leaderboard(m, game, kcgmm) {
    this.bot.sql.transaction(async query => {
        const mapListId = kcgmm.getMapListId(game);
        if(mapListId == null) {
            m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        /** @type {Db.experience_users[]} */
        let resultsUsers = (await query(`SELECT * FROM experience_users
                                         WHERE game = '${game}'`)).results;

        if(resultsUsers.length <= 0) {
            m.channel.send(this.bot.locale.category('experience', 'leaderboard_empty')).catch(logger.error);
            return;
        }

        /** @type {{resultUser: Db.experience_users, total: ExpData}[]} */
        let leaders = [];
        for(let resultUser of resultsUsers) {
            if(!m.guild.members.cache.get(resultUser.user_id)) continue;

            /** @type {any[]} */
            let resultsMaps = (await query(`SELECT * FROM experience_maps
                                            WHERE id_experience_users = '${resultUser.id}'`)).results;

            let mapsParsed = getMapsParsed(mapListId, resultsMaps);
            const totalCompleted = mapsParsed.length;
            
            leaders.push({
                resultUser: resultUser,
                total: getExpDataFromMapsBeaten(mapsParsed, kcgmm, totalCompleted)
            });
        }
        leaders.sort((a, b) => b.total.currentLevel - a.total.currentLevel || b.total.currentXP - a.total.currentXP);


        /** @type {Db.experience_users} */
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
            msgStr += getFormattedXPBarString.call(this, '', leader.total, this.expBarLeadersLength, true);
            msgStr += ` ${member ? member.nickname ?? member.user.username : leader.resultUser.user_name}\n`;

            if(resultUsers && leader.resultUser.user_id === resultUsers.user_id)
                selfFound = true;
        }

        if(resultUsers && !selfFound) {
            /** @type {any[]} */
            let resultsMaps = (await query(`SELECT * FROM experience_maps
                                            WHERE id_experience_users = '${resultUsers.id}'`)).results;

            msgStr += '\n:small_blue_diamond: ';

            let mapsParsed = getMapsParsed(mapListId, resultsMaps);
            const totalCompleted = mapsParsed.length;

            let expData = getExpDataFromMapsBeaten(mapsParsed, kcgmm, totalCompleted);

            msgStr += `\`#${leaders.findIndex(v => v.resultUser.user_id === resultUsers.user_id)+1}\``;
            msgStr += getFormattedXPBarString.call(this, '', expData, this.expBarLeadersLength, true);
            msgStr += ` ${m.member.nickname ?? m.member.user.username}\n`;
        }
        embed.description += msgStr;
        m.channel.send({embed: embed}).catch(logger.error);
    });
}

/**
 * Show the user's experience breakdown for each game.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string|undefined} game
 * @param {KCGameMapManager} kcgmm
 * @param {boolean} dm
 */
function profile(m, game, kcgmm, dm) {
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
            const mapListId = kcgmm.getMapListId(game);
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
                let expData = getExpDataFromMapsBeaten([], kcgmm, 0);
                field.name = getFormattedXPBarString.call(this, emotes[game]||':game_die:', expData, this.expBarLength);

                field.value = Bot.Util.getSpecialWhitespace(3);
                field.value += this.bot.locale.category('experience', 'embed_not_registered_1', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown');
                field.value = Bot.Util.getSpecialWhitespace(3);
                field.value += this.bot.locale.category('experience', 'embed_not_registered_2', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown');
            }
            else {
                /** @type {Db.experience_maps[]} */
                let resultsMaps = (await query(`SELECT * FROM experience_maps
                WHERE id_experience_users = '${resultUsers.id}'`)).results;

                let mapsParsed = getMapsParsed(mapListId, resultsMaps);
                const totalCompleted = mapsParsed.length;

                let expData = getExpDataFromMapsBeaten(mapsParsed, kcgmm, totalCompleted);
                field.name = getFormattedXPBarString.call(this, emotes[game]||':game_die:', expData, this.expBarLength);

                
                let mapsCurrent = getMapsParsed(mapListId, /** @type {number[]} */(JSON.parse(resultUsers.maps_current)));

                let maps = await getMapsCompleted(mapsCurrent, resultUsers.user_name, kcgmm);

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

        let fieldInstructions = {
            name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
            value: this.bot.locale.category('experience', 'embed_instructions_value', game == null ? '[game]' : game),
            inline: false,
        }

        embed.fields.push(fieldInstructions);

        m.channel.send({ embed:embed }).catch(logger.error);
        if(dm) {
            fieldInstructions.value = `${this.bot.locale.category('experience', 'embed_dm_value')}\n${fieldInstructions.value}`;
            m.member.createDM().then(dm => {
                return dm.send({ embed: embed });
            }).catch(logger.error);
        }
    }).catch(logger.error);
}

/**
 * Award experience for completed maps and generate new maps to complete.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game
 * @param {KCGameMapManager} kcgmm
 * @param {boolean} dm
 */
function newMaps(m, game, kcgmm, dm) {
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
        let mapListArrayModified = kcgmm.getMapListArray(game);
        const mapListId = kcgmm.getMapListId(game);
        let mapListIdModified = kcgmm.getMapListId(game);
        if(mapListArrayModified == null || mapListId == null || mapListIdModified == null) {
            m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        //Get ignored maps
        /** @type {Db.experience_maps_ignore[]} */
        var resultsMapsIgnore = (await query(`SELECT * FROM experience_maps_ignore
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        /** @type {Db.experience_maps[]} */
        let resultsMaps = (await query(`SELECT * FROM experience_maps
                                        WHERE id_experience_users = '${resultUsers.id}'`)).results;
        let oldMaps = getMapsParsed(mapListId, resultsMaps);

        let expDataOld = getExpDataFromMapsBeaten(oldMaps, kcgmm, oldMaps.length);
        let xpOld = getFormattedXPBarString.call(this, null, expDataOld, this.expBarLength, false, true);

        let mapsChosenLast = getMapsParsed(mapListId, /** @type {number[]} */(JSON.parse(resultUsers.maps_current)));
        //Find out which maps from current maps are completed.
        let mapsCurrent = await getMapsCompleted(mapsChosenLast, resultUsers.user_name, kcgmm);

        let allMapsCompleted = resultsMaps.map((v => v.map_id)).concat(mapsCurrent.finished.map(v => v.id));
        const totalCompleted = allMapsCompleted.length;
        let mapListArrayByRankModified = kcgmm.getHighestRankedMonthlyMaps(game, 3, 10, allMapsCompleted);
        
        /** @type {KCGameMapManager.MapData[]} */
        let selectedIds = [];
        selectRandomMaps(selectedIds, mapListArrayByRankModified, mapsCurrent.finished, resultsMaps, resultsMapsIgnore, 3);
        selectRandomMaps(selectedIds, mapListArrayModified, mapsCurrent.finished, resultsMaps, resultsMapsIgnore, 6);
        selectedIds.sort((a, b) => getExpFromMap(b, kcgmm, totalCompleted) - getExpFromMap(a, kcgmm, totalCompleted));

        await query(`UPDATE experience_users SET maps_current = '${JSON.stringify(selectedIds.map(v => v.id))}'
                     WHERE user_id = '${m.member.id}' AND game = '${game}'`);
        for(let mapData of mapsCurrent.finished) {
            await query(`INSERT INTO experience_maps (id_experience_users, map_id)
                         VALUES ('${resultUsers.id}', '${mapData.id}')`);
        }
        
        let embed = getEmbedTemplate(m.member);
        embed.color = KCUtil.gameEmbedColors[game];
        embed.description = `Your leaderboards name is \`${resultUsers.user_name}\`\nYou completed ${totalCompleted} maps (XP mult: ${Math.ceil(getExpMultiplier(totalCompleted) * 100)/100}x)`;
        
        embed.fields = [];

        let expDataNew = getExpDataFromMapsBeaten(oldMaps.concat(mapsCurrent.finished), kcgmm, totalCompleted);
        let maps = await getMapsCompleted(selectedIds, resultUsers.user_name, kcgmm);

        let fieldXp = {
            name: emote + ' ',
            value: '',
            inline: false
        }
        let xpNew = getFormattedXPBarString.call(this, null, expDataNew, this.expBarLength, false, true);
        if(expDataOld.currentLevel !== expDataNew.currentLevel || expDataOld.currentXP !== expDataNew.currentXP) {
            fieldXp.name += this.bot.locale.category('experience', 'embed_results_title_1_1');
            fieldXp.value += `\`\`\`${xpOld}\`\`\``;
        }
        else fieldXp.name += this.bot.locale.category('experience', 'embed_results_title_1');
        fieldXp.value += `\`\`\`${xpNew}\`\`\``;

        let fieldNewMaps = {
            name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_2', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown', KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${game}_custom`)),
            value: maps.unfinished.length <= 0 ? `${Bot.Util.getSpecialWhitespace(3)}You've completed everything. Well done!` : '',
            inline: false
        };
        for(let j = 0; j < maps.unfinished.length; j++)
            fieldNewMaps.value += getMapClaimString(maps.unfinished[j], game, kcgmm, totalCompleted) + '\n';

        let fieldBeatenMaps = {
            name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_3'),
            value: '',
            inline: false,
        }
        for(let j = 0; j < maps.finished.length; j++)
            fieldBeatenMaps.value += getMapClaimString(maps.finished[j], game, kcgmm, totalCompleted) + '\n';

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
        if(dm) {
            fieldInstructions.value = `${this.bot.locale.category('experience', 'embed_dm_value')}\n${fieldInstructions.value}`;
            m.member.createDM().then(dm => {
                return dm.send({ embed: embed });
            }).catch(logger.error);
        }
    }).catch(logger.error);
}

/**
 * Wipe a user's experience data for a specific game.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game
 * @param {string} id
 */
function wipe(m, game, id) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.experience_users} */
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
 * Show info about the experience system.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function info(m) {
    const embed = getEmbedTemplate();

    embed.title = this.bot.locale.category('experience', 'intro_name');
    embed.description = this.bot.locale.category('experience', 'intro_value');

    m.channel.send({ embed: embed }).catch(logger.error);
}

/**
 * Add a map to the ignore list.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game 
 * @param {number} map_id
 */
function ignore(m, game, map_id) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users
            WHERE game = '${game}' AND user_id = '${m.member.id}'`)).results[0];
        
        if(!resultUsers) {
            m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        /** @type {Db.experience_maps_ignore[]} */
        var resultsMapsIgnore = (await query(`SELECT * FROM experience_maps_ignore
            WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${map_id}'`)).results;

        if(resultsMapsIgnore.length > 0) {
            m.message.reply(this.bot.locale.category('experience', 'already_ignoring_map')).catch(logger.error);
            return;
        }

        await query(`INSERT INTO experience_maps_ignore (id_experience_users, map_id)
            VALUES ('${resultUsers.id}', '${map_id}')`);

        m.message.reply(this.bot.locale.category('experience', 'map_ignored', map_id+'', game)).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Remove a map from the ignore list.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game 
 * @param {number} map_id
 */
function unignore(m, game, map_id) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users
            WHERE game = '${game}' AND user_id = '${m.member.id}'`)).results[0];
        
        if(!resultUsers) {
            m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        /** @type {Db.experience_maps_ignore[]} */
        var resultsMapsIgnore = (await query(`SELECT * FROM experience_maps_ignore
            WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${map_id}'`)).results;

        if(resultsMapsIgnore.length <= 0) {
            m.message.reply(this.bot.locale.category('experience', 'not_ignoring_map')).catch(logger.error);
            return;
        }

        await query(`DELETE FROM experience_maps_ignore
            WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${map_id}'`);

        m.message.reply(this.bot.locale.category('experience', 'map_unignored', map_id+'', game)).catch(logger.error);
    }).catch(logger.error);
}

/**
 * Display a list of ignored maps.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game 
 */
function ignorelist(m, game) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users
            WHERE game = '${game}' AND user_id = '${m.member.id}'`)).results[0];
        
        if(!resultUsers) {
            m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        /** @type {Db.experience_maps_ignore[]} */
        var resultsMapsIgnore = (await query(`SELECT * FROM experience_maps_ignore
            WHERE id_experience_users = '${resultUsers.id}'`)).results;

        resultsMapsIgnore.sort((a, b) => a.map_id - b.map_id);

        let str = this.bot.locale.category('experience', 'maps_ignored');
        str += ' ';
        str += resultsMapsIgnore.map(v => `\`#${v.map_id}\``).join(', ');

        m.message.reply(str).catch(logger.error);
    }).catch(logger.error);
}



/**
 * Select random maps that haven't been completed yet
 * @param {KCGameMapManager.MapData[]} arr - Array of maps to fill
 * @param {KCGameMapManager.MapData[]} maps - Maps to choose from. Will be mutated
 * @param {KCGameMapManager.MapData[]} mapsChosenLastCompleted - Maps chosen last time
 * @param {Db.experience_maps[]} resultsMaps - Already finished maps
 * @param {Db.experience_maps_ignore[]} resultsMapsIgnore - Maps on ignore list
 * @param {number} count - Amount of maps to pick
 */
function selectRandomMaps(arr, maps, mapsChosenLastCompleted, resultsMaps, resultsMapsIgnore, count) {
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

        //If the map is on our ignore list, don't include it.
        if(resultsMapsIgnore.find(v => v.map_id === map.id))
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
 * @param {number} total - Total maps completed
 * @returns {string}
 */
function getMapClaimString(map, game, kcgmm, total) {
    let str = `\`ID #${map.id}\`: ${getExpFromMap(map, kcgmm, total)} XP - ${map.title} __by ${map.author}__`;

    if(map.timestamp == null) return str;
    let date = kcgmm.getDateFlooredToMonth(new Date(map.timestamp));
    let month = KCUtil.getMonthFromDate(date, true);
    const rank = kcgmm.getMapMonthlyRank(map);
    if(rank == null) return str;

    return `${str} (#${rank} ${month} ${date.getFullYear()})`;
}

/**
 * @this {Experience}
 * @param {string | null} emote 
 * @param {ExpData} expData
 * @param {number} expBarsMax 
 * @param {boolean=} noXpCur 
 * @param {boolean=} noCode 
 * @param {boolean=} arrowOnly
 * @returns {string}
 */
function getFormattedXPBarString(emote, expData, expBarsMax, noXpCur, noCode, arrowOnly) {
    let lvl = arrowOnly ? '' : `Lv.${expData.currentLevel}`;
    expBarsMax -= lvl.length;
    let xpCur = noXpCur ? '' : Bot.Util.String.fixedWidth(arrowOnly ? '' : expData.currentXP+'', 5, ' ');
    expBarsMax -= xpCur.length;
    let xpMax = Bot.Util.String.fixedWidth(arrowOnly ? '' : expData.maxXP+'', 5, ' ', true);
    expBarsMax -= xpMax.length;
    //Miscellaneous characters:
    expBarsMax -= 2;

    let half1 = Math.floor(expBarsMax / 2);
    let half2 = Math.floor(expBarsMax / 2);

    let expPrc = expData.currentXP / expData.maxXP;
    let dotsRemaining =  Math.floor(expBarsMax * (this.dots.length - 1) * expPrc);
    let bar = '';
    for(let i = 0; i < expBarsMax; i++) {
        let dots = Math.min(this.dots.length - 1, dotsRemaining);
        dotsRemaining -= dots;

        bar = `${bar}${arrowOnly ? (i === half1 || i === half2 ? '↓' : this.dots[0]) : this.dots[dots]}`;
    }

    let half = Math.floor(expBarsMax / 2);
    bar = `${bar.substring(0, half)}${lvl}${bar.substring(half)}`;
    bar = arrowOnly ? ` ${bar} ` : `|${bar}|`;

    let str = '';
    str = `${str}${xpCur}${bar}${xpMax}`;
    str = noCode ? str : `\`${str}\``;
    str = emote == null ? `${str}` : `${emote} ${str}`;
    return str;
}

/**
 * @param {KCGameMapManager.MapData} mapData 
 * @param {KCGameMapManager} kcgmm
 * @param {number} total - Total maps beaten
 * @returns {number}
 */
function getExpFromMap(mapData, kcgmm, total) {
    //const rng = seedrandom(mapData.id+'');
    //let value = Math.floor(((rng() / 2) + 0.75) * 100); //0.75 - 1.25
    let value = 100;
    const rank = kcgmm.getMapMonthlyRank(mapData);

    if(mapData.timestamp != null && rank != null)
        value = Math.max(value, value + 200 - ((rank-1) * 20));
    
    return Math.ceil(value * getExpMultiplier(total));
}

/**
 * 
 * @param {number} total - Total maps beaten 
 * @returns {number}
 */
function getExpMultiplier(total) {
    return Math.pow(1.015, total);
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
 * @param {number} total - Total maps beaten
 * @returns {ExpData}
 */
function getExpDataFromMapsBeaten(maps, kcgmm, total) {
    let level = 1;
    let xpToNextLevel = 600; //2000 XP to level 2.
    let xpIncreasePerLevel = 200;
    let totalXp = 0;

    for(let map of maps) {
        totalXp += getExpFromMap(map, kcgmm, total);
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