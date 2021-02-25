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
 * @typedef {object} Db.experience_maps_custom
 * @property {number} id - Primary key
 * @property {number} id_experience_users - Db.experience_users key
 * @property {number} map_id
 * @property {number} state - 0 (selected, incomplete), 1 (complete), 2 (ignored)
 */

/**
 * @typedef {object} Db.experience_maps_campaign
 * @property {number} id - Primary key
 * @property {number} id_experience_users - Db.experience_users key
 * @property {string} game_uid - GUID of the map
 * @property {number} state - 0 (selected, incomplete), 1 (complete), 2 (ignored)
 */


import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import seedrandom from 'seedrandom';
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

import { CustomManager } from './Experience/CustomManager.js';
import { CampaignManager } from './Experience/CampaignManager.js';

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
        this.dots = ['⣀', '⣄', '⣤', '⣦', '⣶', '⣷', '⣿'];
        this.managers = {
            custom: new CustomManager(this),
            campaign: new CampaignManager(this)
        }

        //Experience does not separate entries by guild ID, so we create tables in constructor and not in Module.init()
        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS experience_users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                user_name VARCHAR(128) BINARY NOT NULL,
                game VARCHAR(16) NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps_custom (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                map_id MEDIUMINT UNSIGNED NOT NULL,
                state TINYINT(2) NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps_campaign (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                game_uid VARCHAR(128) BINARY NOT NULL,
                state TINYINT(2) NOT NULL
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

    /**
     * 
     * @param {number} total - Total maps beaten 
     * @returns {number}
     */
    getExpMultiplier(total) {
        return Math.pow(1.015, total);
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
            await query(`INSERT INTO experience_users (user_id, user_name, game)
                         VALUES ('${m.member.id}', '${name}', '${game}')`);

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

            const data_custom = await this.managers.custom.leaderboard(query, resultUser, mapListId);
            const data_campaign = await this.managers.campaign.leaderboard(query, resultUser);

            let totalCompleted = 0;
            totalCompleted += data_custom.countTotalCompleted;
            totalCompleted += data_campaign.countTotalCompleted;

            let totalExp = 0;
            totalExp += this.managers.custom.getExpFromMaps(data_custom.mapsTotalCompleted, kcgmm, totalCompleted);
            totalExp += this.managers.campaign.getExpFromMaps(data_campaign.mapsTotalCompleted, totalCompleted);

            leaders.push({
                resultUser: resultUser,
                total: getExpDataFromTotalExp(totalExp)
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
            msgStr += '\n:small_blue_diamond: ';

            const data_custom = await this.managers.custom.leaderboard(query, resultUsers, mapListId);
            const data_campaign = await this.managers.campaign.leaderboard(query, resultUsers);

            let totalCompleted = 0;
            totalCompleted += data_custom.countTotalCompleted;
            totalCompleted += data_campaign.countTotalCompleted;

            let totalExp = 0;
            totalExp += this.managers.custom.getExpFromMaps(data_custom.mapsTotalCompleted, kcgmm, totalCompleted);
            totalExp += this.managers.campaign.getExpFromMaps(data_campaign.mapsTotalCompleted, totalCompleted);

            msgStr += `\`#${leaders.findIndex(v => v.resultUser.user_id === resultUsers.user_id)+1}\``;
            msgStr += getFormattedXPBarString.call(this, '', getExpDataFromTotalExp(totalExp), this.expBarLeadersLength, true);
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
                let expData = getExpDataFromTotalExp(0);
                field.name = getFormattedXPBarString.call(this, emotes[game]||':game_die:', expData, this.expBarLength);

                field.value = Bot.Util.getSpecialWhitespace(3);
                field.value += this.bot.locale.category('experience', 'embed_not_registered_1', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown');
                field.value = Bot.Util.getSpecialWhitespace(3);
                field.value += this.bot.locale.category('experience', 'embed_not_registered_2', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown');
            }
            else {
                const data_custom = await this.managers.custom.profile(query, kcgmm, resultUsers, mapListId);
                const data_campaign = await this.managers.campaign.profile(query, kcgmm, resultUsers);

                let totalCompleted = 0;
                totalCompleted += data_custom.countTotalCompleted;
                totalCompleted += data_campaign.countTotalCompleted;

                let totalExp = 0;
                totalExp += this.managers.custom.getExpFromMaps(data_custom.mapsTotalCompleted, kcgmm, totalCompleted);
                totalExp += this.managers.campaign.getExpFromMaps(data_campaign.mapsTotalCompleted, totalCompleted);

                let expData = getExpDataFromTotalExp(totalExp);

                field.name = getFormattedXPBarString.call(this, emotes[game]||':game_die:', expData, this.expBarLength);

                let str = '';
                str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_1');
                str += ' ';
                for(let j = 0; j < data_custom.selectedMaps.unfinished.length; j++)
                    str += `\`#${data_custom.selectedMaps.unfinished[j].id}\` `;
                for(let j = 0; j < data_campaign.selectedMaps.unfinished.length; j++)
                    str += `\`${data_campaign.selectedMaps.unfinished[j].mapName}\` `;
                str += '\n';
                str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_2');
                str += ' ';      
                for(let j = 0; j < data_custom.selectedMaps.finished.length; j++)
                    str += `\`#${data_custom.selectedMaps.finished[j].id}\` `;
                for(let j = 0; j < data_campaign.selectedMaps.finished.length; j++)
                    str += `\`${data_campaign.selectedMaps.finished[j].mapName}\` `;
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
        //Get emote for this game
        let emote = ':game_die:';
        await this.bot.sql.transaction(async query => {
            let result = (await query(`SELECT * FROM emotes_game
                WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
            if(result) emote = result.emote;
        }).catch(logger.error);

        //Fetch current user
        /** @type {Db.experience_users} */
        let resultUsers = (await query(`SELECT * FROM experience_users
            WHERE user_id = '${m.member.id}' AND game = '${game}'`)).results[0];

        //Exit if user is not registered
        if(resultUsers == null) {
            m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        const mapListArray = kcgmm.getMapListArray(game);
        const mapListId = kcgmm.getMapListId(game);
        if(mapListArray == null || mapListId == null) {
            m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }


        const data_custom = await this.managers.custom.newMaps(query, kcgmm, resultUsers, mapListArray, mapListId);
        const data_campaign = await this.managers.campaign.newMaps(query, kcgmm, resultUsers);

        let totalCompletedOld = 0;
        totalCompletedOld += data_custom.countOldTotalCompleted;
        totalCompletedOld += data_campaign.countOldTotalCompleted;

        let totalCompletedNew = 0;
        totalCompletedNew += data_custom.countNewTotalCompleted;
        totalCompletedNew += data_campaign.countNewTotalCompleted;

        let totalExpOld = 0;
        totalExpOld += this.managers.custom.getExpFromMaps(data_custom.oldMapsTotalCompleted, kcgmm, totalCompletedOld);
        totalExpOld += this.managers.campaign.getExpFromMaps(data_campaign.oldMapsTotalCompleted, totalCompletedOld);

        let totalExpNew = totalExpOld;
        totalExpNew += this.managers.custom.getExpFromMaps(data_custom.oldSelectedMaps.finished, kcgmm, totalCompletedNew);
        totalExpNew += this.managers.campaign.getExpFromMaps(data_campaign.oldSelectedMaps.finished, totalCompletedNew);

        const expDataOld = getExpDataFromTotalExp(totalExpOld);

        const expDataNew = getExpDataFromTotalExp(totalExpNew);
        const expBarOld = getFormattedXPBarString.call(this, null, expDataOld, this.expBarLength, false, true);
        const expBarNew = getFormattedXPBarString.call(this, null, expDataNew, this.expBarLength, false, true);

        
        let embed = getEmbedTemplate(m.member);
        embed.color = KCUtil.gameEmbedColors[game];
        embed.description = `Your leaderboards name is \`${resultUsers.user_name}\`\nYou completed ${totalCompletedNew} maps (XP mult: ${Math.ceil(this.getExpMultiplier(totalCompletedNew) * 100)/100}x)`;
        
        embed.fields = [];
        
        let fieldXp = {
            name: emote + ' ',
            value: '',
            inline: false
        }
        
        if(expDataOld.currentLevel !== expDataNew.currentLevel || expDataOld.currentXP !== expDataNew.currentXP) {
            fieldXp.name += this.bot.locale.category('experience', 'embed_results_title_1_1');
            fieldXp.value += `\`\`\`${expBarOld}\`\`\``;
        }
        else fieldXp.name += this.bot.locale.category('experience', 'embed_results_title_1');
        fieldXp.value += `\`\`\`${expBarNew}\`\`\``;

        let fieldNewMaps = {
            name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_2', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown', KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${game}_custom`)),
            value: '',
            inline: false
        };
        for(let map of data_custom.newSelectedMaps.unfinished)
            fieldNewMaps.value += this.managers.custom.getMapClaimString(map, kcgmm, totalCompletedNew) + '\n';
        for(let map of data_campaign.newSelectedMaps.unfinished)
            fieldNewMaps.value += this.managers.campaign.getMapClaimString(map, totalCompletedNew) + '\n';
        if(fieldNewMaps.value.length === 0)
            fieldNewMaps.value = `${Bot.Util.getSpecialWhitespace(3)}You've completed everything. Well done!`;

        let fieldBeatenMaps = {
            name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_3'),
            value: '',
            inline: false,
        }
        for(let map of data_custom.newSelectedMaps.finished)
            fieldBeatenMaps.value += this.managers.custom.getMapClaimString(map, kcgmm, totalCompletedNew) + '\n';
        for(let map of data_campaign.newSelectedMaps.finished)
            fieldBeatenMaps.value += this.managers.campaign.getMapClaimString(map, totalCompletedNew) + '\n';

        let fieldInstructions = {
            name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
            value: this.bot.locale.category('experience', 'embed_results_value', game),
            inline: false
        }

        embed.fields.push(fieldXp);
        embed.fields.push(fieldNewMaps);
        if(fieldBeatenMaps.value.length > 0)
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
        await query (`DELETE FROM experience_maps_custom
                      WHERE id_experience_users = '${resultUsers.id}'`);
        await query (`DELETE FROM experience_maps_campaign
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

        /** @type {Db.experience_maps_custom|undefined} */
        var resultMapsCustom = (await query(`SELECT * FROM experience_maps_custom
        WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${map_id}'`)).results[0];

        if(resultMapsCustom) {
            if(resultMapsCustom.state === 1) {
                m.message.reply(this.bot.locale.category('experience', 'already_completed_map')).catch(logger.error);
                return;
            }
            else if(resultMapsCustom.state === 2) {
                m.message.reply(this.bot.locale.category('experience', 'already_ignoring_map')).catch(logger.error);
                return;
            }
        }

        if(!resultMapsCustom || (resultMapsCustom && resultMapsCustom.state === 0)) {
            if(resultMapsCustom) {
                await query(`DELETE FROM experience_maps_custom
                    WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${map_id}' AND state = '0'`);
            }
            await query(`INSERT INTO experience_maps_custom (id_experience_users, map_id, state)
                VALUES ('${resultUsers.id}', '${map_id}', '2')`);

            m.message.reply(this.bot.locale.category('experience', 'map_ignored', map_id+'', game)).catch(logger.error);
        }
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

        /** @type {Db.experience_maps_custom|undefined} */
        var resultMapsCustom = (await query(`SELECT * FROM experience_maps_custom
        WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${map_id}' AND state = '2'`)).results[0];

        if(resultMapsCustom == null) {
            m.message.reply(this.bot.locale.category('experience', 'not_ignoring_map')).catch(logger.error);
            return;
        }

        await query(`DELETE FROM experience_maps_custom
            WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${map_id}' AND state = '2'`);

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

        /** @type {Db.experience_maps_custom[]} */
        var resultsMapsCustom = (await query(`SELECT * FROM experience_maps_custom
        WHERE id_experience_users = '${resultUsers.id}' AND state = '2'`)).results;


        resultsMapsCustom.sort((a, b) => a.map_id - b.map_id);

        let str = this.bot.locale.category('experience', 'maps_ignored');
        str += ' ';
        str += resultsMapsCustom.map(v => `\`#${v.map_id}\``).join(', ');

        m.message.reply(str).catch(logger.error);
    }).catch(logger.error);
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
 * @param {number} exp
 * @returns {ExpData}
 */
function getExpDataFromTotalExp(exp) {
    let level = 1;
    let xpToNextLevel = 600; //2000 XP to level 2.
    let xpIncreasePerLevel = 200;
    let totalXp = exp;

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

