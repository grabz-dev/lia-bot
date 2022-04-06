'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */

/**
 * @typedef {object} ExpData
 * @property {number} currentXP
 * @property {number} maxXP
 * @property {number} currentLevel
 */

/**
 * @typedef {object} Db.experience_messages
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {string} game
 * @property {Discord.Snowflake} channel_id
 * @property {Discord.Snowflake} message_id
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

/**
 * @typedef {object} Db.experience_maps_markv
 * @property {number} id - Primary key
 * @property {number} id_experience_users - Db.experience_users key
 * @property {string} seed - seed of the Mark V map
 * @property {number} state - 0 (selected, incomplete), 1 (complete), 2 (ignored)
 */


import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import seedrandom from 'seedrandom';
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

import { CustomManager, getMapsCompleted } from './Experience/CustomManager.js';
import { CampaignManager } from './Experience/CampaignManager.js';
import { MarkVManager } from './Experience/MarkVManager.js';

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
            campaign: new CampaignManager(this),
            markv: new MarkVManager(this),
        }
        this.symbols = ["", "K", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "D"];

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS experience_messages (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                game VARCHAR(16) NOT NULL,
                channel_id VARCHAR(64) NOT NULL,
                message_id VARCHAR(64) NOT NULL
             )`);
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
            await query(`CREATE TABLE IF NOT EXISTS experience_maps_markv (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                seed VARCHAR(128) BINARY NOT NULL,
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
     * @param {'info'|'rename'|'register'|'leaderboard'|'profile'|'new'|'ignore'|'unignore'|'ignorelist'|'message'} ext.action - Custom parameters provided to function call.
     * @param {KCGameMapManager} ext.kcgmm
     * @param {import('./Champion.js').default} ext.champion
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'register':
        case 'leaderboard':
        case 'new':
        case 'rename':
        case 'ignore':
        case 'unignore':
        case 'ignorelist':
        case 'message': {
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

                if(arg.indexOf('[M] ') > -1) {
                    return 'Your name cannot contain the Mverse [M] prefix.';
                }

                if(arg.indexOf('`') > -1 || arg.indexOf('&') > -1 || arg.indexOf('?') > -1 || arg.indexOf('=') > -1) {
                    return 'One or more disallowed characters used in leaderboard name.';
                }

                register.call(this, m, game, arg);
                return;
            case 'leaderboard':
                leaderboard.call(this, m, game, ext.kcgmm, ext.champion);
                return;
            case 'new':
                newMaps.call(this, m, game, ext.kcgmm, (args[1]??'').toLowerCase().includes('dm'));
                return;
            case 'rename':
                let argSnowflake = args[1];
                if(argSnowflake == null)
                    return this.bot.locale.category('experience', 'err_user_mention_not_provided');

                let snowflake = Bot.Util.getSnowflakeFromDiscordPing(argSnowflake);
                if(snowflake == null) {
                    return this.bot.locale.category('experience', 'err_user_mention_not_correct');
                }

                let userName = arg.substring(arg.indexOf(args[1]) + args[1].length + 1);
                
                rename.call(this, m, game, snowflake, userName);
                return;
            case 'ignore':
            case 'unignore':
                let rest = arg.indexOf('rest') > -1;
                let mapIdsStr = args.slice(1);
                /** @type {number[]} */
                let mapIdsNum = [];
                for(let mapIdStr of mapIdsStr) {
                    let mapId = +mapIdStr;
                    if(Number.isFinite(mapId)) {
                        mapIdsNum.push(mapId);
                    }
                }
                if(mapIdsNum.length <= 0 && !rest) {
                    return this.bot.locale.category('experience', 'err_map_id_invalid');
                }
                mapIdsNum = mapIdsNum.slice(0, 10);
                ext.action === 'ignore' ? 
                    ignore.call(this, m, game, mapIdsNum, true, rest ? { rest: rest, kcgmm: ext.kcgmm } : undefined)
                    : 
                    ignore.call(this, m, game, mapIdsNum, false, rest ? { rest: rest, kcgmm: ext.kcgmm } : undefined)
                return;
            case 'ignorelist':
                ignorelist.call(this, m, game);
                return;
            case 'message':
                message.call(this, m, game, ext.kcgmm, ext.champion);
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
     * @param {Discord.Guild} guild 
     * @param {KCGameMapManager} kcgmm
     * @param {import('./Champion.js').default} champion
     * @returns {Promise<void>}
     */
    async loop(guild, kcgmm, champion) {
        this.bot.sql.transaction(async query => {
            /** @type {{game: string, userId: Discord.Snowflake}[]} */
            let arr = [];

            for(let game of this.games) {
                /** @type {Db.experience_messages|null} */
                var resultMessages = (await query(`SELECT * FROM experience_messages
                    WHERE guild_id = '${guild.id}' AND game = '${game}'`)).results[0];
                if(resultMessages == null) continue;

                const channel = guild.channels.resolve(resultMessages.channel_id);
                if(channel == null || !(channel instanceof Discord.TextChannel)) continue;

                const message = await channel.messages.fetch(resultMessages.message_id).catch(() => {});
                if(message == null) continue;

                const mapListId = getMapListId.call(this, kcgmm, game);
                if(mapListId == null) continue;

                let embed = await getLeaderboardEmbed.call(this, query, kcgmm, mapListId, guild, game);
                embed.footer = {
                    text: '!exp'
                }
                message.edit({ embeds: [embed] }).catch(logger.error);

                /** @type {Discord.Snowflake|null} */
                let user = this.cache.get(guild.id, `champion_${game}`);
                if(user != null) arr.push({
                    game: game,
                    userId: user
                })
            }

            await champion.refreshExperienceChampions(query, guild, arr);
        }).catch(logger.error);
    }

    /**
     * 
     * @param {number} total - Total maps beaten 
     * @returns {number}
     */
    getExpMultiplier(total) {
        return Math.pow(1.015, total);
    }

    /**
     * @param {number} num
     * @returns {string} 
     */
    prettify(num) {
        const offset = 1;
        const digits = num === 0 ? 1 : Math.floor(Math.log10(Math.abs(num))) + 1;
        const tier = digits <= 5 ? 0 : Math.floor((digits - offset) / 3);

        var suffix = this.symbols[tier];
        if(suffix == null) return ''+num;

        return (num / Math.pow(10, tier * 3)).toFixed(tier === 0 ? 0 : 3 - (digits - offset) % 3 - 1) + suffix;
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
        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_id = ? AND user_name = ? FOR UPDATE`, [game, m.member.id, name])).results[0];
        if(resultUsers != null) {
            m.message.reply(this.bot.locale.category('experience', 'already_registered_with_this_name', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_name = ? FOR UPDATE`, [game, name])).results[0];
        if(resultUsers != null) {
            m.message.reply(this.bot.locale.category('experience', 'name_taken', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_id = ? FOR UPDATE`, [game, m.member.id])).results[0];
        if(resultUsers != null) {
            m.message.reply(this.bot.locale.category('experience', 'already_registered_with_other_name', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        if(this.cache.get(m.guild.id, 'pendingRegistration.' + m.guild.id) === name) {
            await query(`INSERT INTO experience_users (user_id, user_name, game) VALUES (?, ?, ?)`, [m.member.id, name, game]);

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
 * @param {import('./Champion.js').default} champion
 */
function leaderboard(m, game, kcgmm, champion) {
    this.bot.sql.transaction(async query => {
        const mapListId = getMapListId.call(this, kcgmm, game);
        if(mapListId == null) {
            m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        const embed = await getLeaderboardEmbed.call(this, query, kcgmm, mapListId, m.guild, game, m.member);
        m.channel.send({embeds: [embed]}).catch(logger.error);
    }).then(async () => {
        await this.loop(m.guild, kcgmm, champion);
    }).catch(logger.error);
}

/**
 * Build an autoupdating leaderboard message.
 * @this {Experience}
 * @param {Bot.Message} m 
 * @param {string} game 
 * @param {KCGameMapManager} kcgmm
 * @param {import('./Champion.js').default} champion
 */
function message(m, game, kcgmm, champion) {
    this.bot.sql.transaction(async query => {
        let message = await m.channel.send('...');

        await query(`DELETE FROM experience_messages WHERE guild_id = '${m.guild.id}' AND game = '${game}'`);
        await query(`INSERT INTO experience_messages (guild_id, game, channel_id, message_id)
            VALUES ('${m.guild.id}', '${game}', '${message.channel.id}', '${message.id}')`);
    }).then(async () => {
        await this.loop(m.guild, kcgmm, champion);
    }).catch(logger.error);
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
            const mapListId = getMapListId.call(this, kcgmm, game);
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
                const data_markv = await this.managers.markv.profile(query, kcgmm, resultUsers);

                let totalCompleted = 0;
                totalCompleted += data_custom.countTotalCompleted;
                totalCompleted += data_campaign.countTotalCompleted;
                totalCompleted += data_markv.countTotalCompleted;

                let totalExp = 0;
                totalExp += this.managers.custom.getExpFromMaps(data_custom.mapsTotalCompleted, kcgmm, totalCompleted);
                totalExp += this.managers.campaign.getExpFromMaps(data_campaign.mapsTotalCompleted, totalCompleted);
                totalExp += this.managers.markv.getExpFromMaps(data_markv.mapsTotalCompleted, totalCompleted);

                if(games.length === 1)
                    embed.description = await getProfileInfoString.call(this, totalCompleted, resultUsers, query, kcgmm, mapListId, m.guild, m.member, game);

                let expData = getExpDataFromTotalExp(totalExp);

                field.name = getFormattedXPBarString.call(this, emotes[game]||':game_die:', expData, this.expBarLength);

                let str = '';
                str += this.bot.locale.category('experience', 'embed_maps_2');
                str += ' ';
                for(let j = 0; j < data_custom.selectedMaps.finished.length; j++)
                    str += `\`#${data_custom.selectedMaps.finished[j].id}\` `;
                for(let j = 0; j < data_campaign.selectedMaps.finished.length; j++)
                    str += `\`${data_campaign.selectedMaps.finished[j].mapName}\` `;
                for(let j = 0; j < data_markv.selectedMaps.finished.length; j++)
                    str += `\`${data_markv.selectedMaps.finished[j]}\` `;
                str += '\n';
                str += this.bot.locale.category('experience', 'embed_maps_1');
                if(games.length === 1) {
                    str += '\n';
                    for(let map of data_custom.selectedMaps.unfinished)
                        str += this.managers.custom.getMapClaimString(map, kcgmm, totalCompleted) + '\n';
                    for(let map of data_campaign.selectedMaps.unfinished)
                        str += this.managers.campaign.getMapClaimString(map, totalCompleted) + '\n';
                    for(let map of data_markv.selectedMaps.unfinished)
                        str += this.managers.markv.getMapClaimString(map, totalCompleted) + '\n';
                    str = str.substring(0, str.length - 1);
                }
                else {
                    for(let j = 0; j < data_custom.selectedMaps.unfinished.length; j++)
                        str += `\`#${data_custom.selectedMaps.unfinished[j].id}\` `;
                    for(let j = 0; j < data_campaign.selectedMaps.unfinished.length; j++)
                        str += `\`${data_campaign.selectedMaps.unfinished[j].mapName}\` `;
                    for(let j = 0; j < data_markv.selectedMaps.unfinished.length; j++)
                        str += `\`${data_markv.selectedMaps.unfinished[j]}\` `;
                }
                
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

        m.channel.send({ embeds:[embed] }).catch(logger.error);
        if(dm) {
            fieldInstructions.value = `${this.bot.locale.category('experience', 'embed_dm_value')}\n${fieldInstructions.value}`;
            m.member.createDM().then(dm => {
                return dm.send({ embeds: [embed] });
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
        //Fetch current user
        /** @type {Db.experience_users} */
        let resultUsers = (await query(`SELECT * FROM experience_users
            WHERE user_id = '${m.member.id}' AND game = '${game}' FOR UPDATE`)).results[0];

        //Get emote for this game
        let emote = ':game_die:';
        await this.bot.sql.transaction(async query => {
            let result = (await query(`SELECT * FROM emotes_game
                WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
            if(result) emote = result.emote;
        }).catch(logger.error);

        //Exit if user is not registered
        if(resultUsers == null) {
            m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        const mapListArray = getMapListArray.call(this, kcgmm, game);
        const mapListId = getMapListId.call(this, kcgmm, game);
        if(mapListArray == null || mapListId == null) {
            m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }


        const data_custom = await this.managers.custom.newMaps(query, kcgmm, resultUsers, mapListArray, mapListId);
        const data_campaign = await this.managers.campaign.newMaps(query, kcgmm, resultUsers);
        const data_markv = await this.managers.markv.newMaps(query, kcgmm, resultUsers);

        let totalCompletedOld = 0;
        totalCompletedOld += data_custom.countOldTotalCompleted;
        totalCompletedOld += data_campaign.countOldTotalCompleted;
        totalCompletedOld += data_markv.countOldTotalCompleted;

        let totalCompletedNew = 0;
        totalCompletedNew += data_custom.countNewTotalCompleted;
        totalCompletedNew += data_campaign.countNewTotalCompleted;
        totalCompletedNew += data_markv.countNewTotalCompleted;

        let totalExpOld = 0;
        totalExpOld += this.managers.custom.getExpFromMaps(data_custom.oldMapsTotalCompleted, kcgmm, totalCompletedOld);
        totalExpOld += this.managers.campaign.getExpFromMaps(data_campaign.oldMapsTotalCompleted, totalCompletedOld);
        totalExpOld += this.managers.markv.getExpFromMaps(data_markv.oldMapsTotalCompleted, totalCompletedOld);

        let totalExpNew = 0;
        totalExpNew += this.managers.custom.getExpFromMaps(data_custom.oldMapsTotalCompleted, kcgmm, totalCompletedNew);
        totalExpNew += this.managers.custom.getExpFromMaps(data_custom.oldSelectedMaps.finished, kcgmm, totalCompletedNew);
        totalExpNew += this.managers.campaign.getExpFromMaps(data_campaign.oldMapsTotalCompleted, totalCompletedNew);
        totalExpNew += this.managers.campaign.getExpFromMaps(data_campaign.oldSelectedMaps.finished, totalCompletedNew);
        totalExpNew += this.managers.markv.getExpFromMaps(data_markv.oldMapsTotalCompleted, totalCompletedNew);
        totalExpNew += this.managers.markv.getExpFromMaps(data_markv.oldSelectedMaps.finished, totalCompletedNew);

        const expDataOld = getExpDataFromTotalExp(totalExpOld);

        const expDataNew = getExpDataFromTotalExp(totalExpNew);
        const expBarOld = getFormattedXPBarString.call(this, null, expDataOld, this.expBarLength, false, false, true);
        const expBarNew = getFormattedXPBarString.call(this, null, expDataNew, this.expBarLength, false, false, true);

        
        let embed = getEmbedTemplate(m.member);
        embed.color = KCUtil.gameEmbedColors[game];
        embed.description = await getProfileInfoString.call(this, totalCompletedNew, resultUsers, query, kcgmm, mapListId, m.guild, m.member, game);

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
        for(let map of data_markv.newSelectedMaps.unfinished)
            fieldNewMaps.value += this.managers.markv.getMapClaimString(map, totalCompletedNew) + '\n';
        if(fieldNewMaps.value.length === 0)
            fieldNewMaps.value = `${Bot.Util.getSpecialWhitespace(3)}You've completed everything. Well done!`;

        let fieldBeatenMaps = {
            name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_3'),
            value: '',
            inline: false,
        }
        for(let map of data_custom.newSelectedMaps.finished)
            fieldBeatenMaps.value += this.managers.custom.getMapClaimString(map, kcgmm, totalCompletedNew, true) + '\n';
        for(let map of data_campaign.newSelectedMaps.finished)
            fieldBeatenMaps.value += this.managers.campaign.getMapClaimString(map, totalCompletedNew, true) + '\n';
        for(let map of data_markv.newSelectedMaps.finished)
            fieldBeatenMaps.value += this.managers.markv.getMapClaimString(map, totalCompletedNew, true) + '\n';
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

        m.channel.send({ embeds:[embed] }).catch(logger.error);
        if(dm) {
            fieldInstructions.value = `${this.bot.locale.category('experience', 'embed_dm_value')}\n${fieldInstructions.value}`;
            m.member.createDM().then(dm => {
                return dm.send({ embeds: [embed] });
            }).catch(logger.error);
        }
    }).catch(logger.error);
}

/**
 * Rename a user's name in their registration entry
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game
 * @param {string} id
 * @param {string} userName
 */
function rename(m, game, id, userName) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_id = ? FOR UPDATE`, [game, id])).results[0];

        if(!resultUsers) {
            m.message.reply(this.bot.locale.category('experience', 'rename_failed_not_registered')).catch(logger.error);
            return;
        }

        /** @type {Db.experience_users} */
        var resultUsersExists = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_name = ?`, [game, userName])).results[0];
        if(resultUsersExists) {
            m.message.reply(`Failed to change name. A user with the name \`${userName}\` is already registered for ${KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'}.`).catch(logger.error);
            return;
        }

        await query(`UPDATE experience_users SET user_name = ? WHERE id = ?`, [userName, resultUsers.id]);

        m.channel.send(this.bot.locale.category('experience', 'rename_successful', resultUsers.user_name, userName, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
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

    m.channel.send({ embeds: [embed] }).catch(logger.error);
}

/**
 * Add a map to the ignore list.
 * @this {Experience}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} game 
 * @param {number[]} mapIds
 * @param {boolean} ignore
 * @param {{rest: boolean, kcgmm: KCGameMapManager}=} opts
 */
function ignore(m, game, mapIds, ignore, opts) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.experience_users} */
        var resultUsers = (await query(`SELECT * FROM experience_users
            WHERE game = '${game}' AND user_id = '${m.member.id}' FOR UPDATE`)).results[0];
        
        if(!resultUsers) {
            m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
            return;
        }

        if(opts) {
            /** @type {Db.experience_maps_custom[]} */
            const resultsMapsCustom = (await query(`SELECT * FROM experience_maps_custom WHERE id_experience_users = '${resultUsers.id}' AND state = 0`)).results;
            const mapList = opts.kcgmm.getMapListId(game);
            if(mapList) {
                /** @type {KCGameMapManager.MapData[]} */
                const maps = [];
                for(const dbMap of resultsMapsCustom) {
                    const map = mapList.get(dbMap.map_id);
                    if(map == null) continue;
                    if(mapIds.includes(map.id)) continue;
                    maps.push(map);
                }

                for(const map of (await getMapsCompleted(maps, resultUsers.user_name, opts.kcgmm)).unfinished) {
                    mapIds.push(map.id);
                }
            }
        }

        let str = '';

        if(ignore) {
            //0 - selected
            //1 - finished
            //2 - ignored
            /** @type {string[][]} */
            const mapsDb = [[], [], []];
            /** @type {string[]} */
            const mapsNewIgnored = [];
            for(let mapId of mapIds) {
                /** @type {Db.experience_maps_custom|undefined} */
                var resultMapsCustom = (await query(`SELECT * FROM experience_maps_custom
                WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${mapId}'`)).results[0];

                if(resultMapsCustom) {
                    mapsDb[resultMapsCustom.state].push(`#${mapId}`);
                }

                if(!resultMapsCustom || (resultMapsCustom && resultMapsCustom.state === 0)) {
                    mapsNewIgnored.push(`#${mapId}`);

                    if(resultMapsCustom) {
                        await query(`DELETE FROM experience_maps_custom
                            WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${mapId}' AND state = '0'`);
                    }
                    await query(`INSERT INTO experience_maps_custom (id_experience_users, map_id, state)
                        VALUES ('${resultUsers.id}', '${mapId}', '2')`);
                }
            }

            if(mapsNewIgnored.length > 0) str += `${this.bot.locale.category('experience', 'map_ignored', mapsNewIgnored.join(', '), game)}\n`;
            if(mapsDb[1].length > 0) str += `${this.bot.locale.category('experience', 'already_completed_map', mapsDb[1].join(', '))}\n`;
            if(mapsDb[2].length > 0) str += `${this.bot.locale.category('experience', 'already_ignoring_map', mapsDb[2].join(', '))}\n`;
            if(str.length === 0) str = 'Nothing happened.';
        }
        else {
            /** @type {string[]} */
            const mapsNotIgnoring = [];
            /** @type {string[]} */
            const mapsUnignored = [];

            for(let mapId of mapIds) {
                /** @type {Db.experience_maps_custom|undefined} */
                var resultMapsCustom = (await query(`SELECT * FROM experience_maps_custom
                WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${mapId}' AND state = '2'`)).results[0];

                if(resultMapsCustom == null) {
                    mapsNotIgnoring.push(`#${mapId}`);
                    continue;
                }

                mapsUnignored.push(`#${mapId}`);
                await query(`DELETE FROM experience_maps_custom
                    WHERE id_experience_users = '${resultUsers.id}' AND map_id = '${mapId}' AND state = '2'`);
            }

            if(mapsNotIgnoring.length > 0) str += `${this.bot.locale.category('experience', 'not_ignoring_map', mapsNotIgnoring.join(', '))}\n`;
            if(mapsUnignored.length > 0) str += `${this.bot.locale.category('experience', 'map_unignored', mapsUnignored.join(', '), game)}\n`;
            if(str.length === 0) str = 'Nothing happened.';
        }

        m.message.reply(str).catch(logger.error);
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
 * @param {boolean=} noXpMax
 * @param {boolean=} noCode 
 * @param {boolean=} noBars 
 * @returns {string}
 */
function getFormattedXPBarString(emote, expData, expBarsMax, noXpCur, noXpMax, noCode, noBars) {
    let lvl = `Lv.${this.prettify(expData.currentLevel)}`;
    expBarsMax -= lvl.length;
    let xpCur = noXpCur ? '' : Bot.Util.String.fixedWidth(this.prettify(expData.currentXP), 5, ' ');
    expBarsMax -= xpCur.length;
    let xpMax = noXpMax ? '' : Bot.Util.String.fixedWidth(this.prettify(expData.maxXP), 5, ' ', true);
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

        bar = `${bar}${this.dots[dots]}`;
    }

    let half = Math.floor(expBarsMax / 2);
    bar = `${bar.substring(0, half)}${lvl}${bar.substring(half)}`;
    if(!noBars) bar = `|${bar}|`;

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

/**
 * @this {Experience}
 * @param {SQLWrapper.Query} query
 * @param {KCGameMapManager} kcgmm 
 * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId
 * @param {Discord.Guild} guild
 * @param {string} game 
 * @returns {Promise<{ resultUser: Db.experience_users; total: ExpData; }[]>}
 */
async function getLeaderboard(query, kcgmm, mapListId, guild, game) {
    /** @type {Db.experience_users[]} */
    let resultsUsers = (await query(`SELECT * FROM experience_users
        WHERE game = '${game}'`)).results;

    /** @type {{resultUser: Db.experience_users, total: ExpData}[]} */
    let leaders = [];
    for(let resultUser of resultsUsers) {
        if(!guild.members.cache.get(resultUser.user_id)) continue;

        const data_custom = await this.managers.custom.leaderboard(query, resultUser, mapListId);
        const data_campaign = await this.managers.campaign.leaderboard(query, resultUser);
        const data_markv = await this.managers.markv.leaderboard(query, resultUser);

        let totalCompleted = 0;
        totalCompleted += data_custom.countTotalCompleted;
        totalCompleted += data_campaign.countTotalCompleted;
        totalCompleted += data_markv.countTotalCompleted;

        let totalExp = 0;
        totalExp += this.managers.custom.getExpFromMaps(data_custom.mapsTotalCompleted, kcgmm, totalCompleted);
        totalExp += this.managers.campaign.getExpFromMaps(data_campaign.mapsTotalCompleted, totalCompleted);
        totalExp += this.managers.markv.getExpFromMaps(data_markv.mapsTotalCompleted, totalCompleted);

        if(totalExp > 0) {
            leaders.push({
                resultUser: resultUser,
                total: getExpDataFromTotalExp(totalExp)
            });
        }
    }
    leaders.sort((a, b) => b.total.currentLevel - a.total.currentLevel || b.total.currentXP - a.total.currentXP);
    return leaders;
}

/**
 * @this {Experience}
 * @param {SQLWrapper.Query} query
 * @param {KCGameMapManager} kcgmm 
 * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId
 * @param {Discord.Guild} guild
 * @param {string} game 
 * @param {Discord.GuildMember=} member
 * @returns {Promise<Discord.MessageEmbed>}
 */
async function getLeaderboardEmbed(query, kcgmm, mapListId, guild, game, member) {
    const leaders = await getLeaderboard.call(this, query, kcgmm, mapListId, guild, game);

    /** @type {Db.experience_users|null} */
    let resultUsers = member == null ? null : (await query(`SELECT * FROM experience_users
        WHERE game = '${game}' and user_id = '${member.id}'`)).results[0];
    
    let emote = ':game_die:';
    await this.bot.sql.transaction(async query => {
        let result = (await query(`SELECT * FROM emotes_game
                                    WHERE guild_id = '${guild.id}' AND game = '${game}'`)).results[0];
        if(result) emote = result.emote;
    }).catch(logger.error);


    let embed = getEmbedTemplate(member);
    embed.color = KCUtil.gameEmbedColors[game];
    embed.description = `${emote} ${this.bot.locale.category('experience', 'leaderboard_title', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')}\n`;
    let msgStr = '';

    let selfFound = false;
    for(let i = 0; i < Math.min(9, leaders.length); i++) {
        let leader = leaders[i];
        let leaderMember = guild.members.resolve(leader.resultUser.user_id);
        if(i === 0) this.cache.set(guild.id, `champion_${game}`, leader.resultUser.user_id);

        if(member) {
            switch(i) {
                case 0: {
                    msgStr += '🏆 ';
                    break;
                }
                default: {
                    msgStr += '🔹 ';
                    break;
                }
            }
            msgStr += `\`#${i+1}\``;
            msgStr += getFormattedXPBarString.call(this, '', leader.total, this.expBarLeadersLength, true);
            msgStr += ` ${leaderMember ? leaderMember.nickname ?? leaderMember.user.username : leader.resultUser.user_name}\n`;
        }
        else {
            let name = leaderMember ? leaderMember.nickname ?? leaderMember.user.username : leader.resultUser.user_name;
            if(name.length > 18) {
                name = `${name.substring(0, 18)}...`;
            }
            msgStr += `\`#${i+1}${getFormattedXPBarString.call(this, '', leader.total, 14, true, true, true)}\` ${name}\n`;
        }

        if(resultUsers && leader.resultUser.user_id === resultUsers.user_id)
            selfFound = true;
    }

    if(member != null && resultUsers != null && !selfFound) {
        let user = resultUsers;

        msgStr += '\n🔸 ';

        const data_custom = await this.managers.custom.leaderboard(query, user, mapListId);
        const data_campaign = await this.managers.campaign.leaderboard(query, user);
        const data_markv = await this.managers.markv.leaderboard(query, user);

        let totalCompleted = 0;
        totalCompleted += data_custom.countTotalCompleted;
        totalCompleted += data_campaign.countTotalCompleted;

        let totalExp = 0;
        totalExp += this.managers.custom.getExpFromMaps(data_custom.mapsTotalCompleted, kcgmm, totalCompleted);
        totalExp += this.managers.campaign.getExpFromMaps(data_campaign.mapsTotalCompleted, totalCompleted);
        totalExp += this.managers.markv.getExpFromMaps(data_markv.mapsTotalCompleted, totalCompleted);

        msgStr += `\`#${leaders.findIndex(v => v.resultUser.user_id === user.user_id)+1}\``;
        msgStr += getFormattedXPBarString.call(this, '', getExpDataFromTotalExp(totalExp), this.expBarLeadersLength, true);
        msgStr += ` ${member.nickname ?? member.user.username}\n`;
    }
    embed.description += msgStr;
    return embed;
}

/**
 * @this {Experience}
 * @param {KCGameMapManager} kcgmm
 * @param {string} game 
 * @returns {Discord.Collection<number, KCGameMapManager.MapData> | null}
 */
function getMapListId(kcgmm, game) {
    if(game !== 'cw4') return kcgmm.getMapListId(game);

    var arr = kcgmm.getMapListArray(game);
    if(arr == null) return null;

    /** @type {Discord.Collection<number, KCGameMapManager.MapData>} */
    const obj = new Discord.Collection();

    for(let map of arr) {
        if(map.tags && map.tags.includes('MVERSE')) continue;
        obj.set(map.id, map);
    }
    return obj;
}

/**
 * @this {Experience}
 * @param {KCGameMapManager} kcgmm
 * @param {string} game 
 * @returns {Readonly<KCGameMapManager.MapData>[] | null}
 */
function getMapListArray(kcgmm, game) {
    if(game !== 'cw4') return kcgmm.getMapListArray(game);

    var arr = kcgmm.getMapListArray(game);
    if(arr == null) return null;

    return arr.filter(v => !(v.tags && v.tags.includes('MVERSE')));
}

/**
 * @this {Experience}
 * @param {number} totalCompletedNew
 * @param {Db.experience_users} resultUsers
 * @param {SQLWrapper.Query} query
 * @param {KCGameMapManager} kcgmm 
 * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId
 * @param {Discord.Guild} guild
 * @param {Discord.GuildMember} member
 * @param {string} game
 * @returns {Promise<string>}
 */
async function getProfileInfoString(totalCompletedNew, resultUsers, query, kcgmm, mapListId, guild, member, game) {
    const xpMult = Math.ceil(this.getExpMultiplier(totalCompletedNew) * 100)/100;
    let str = `Your leaderboards name is \`${resultUsers.user_name}\`\nYou've completed **${totalCompletedNew}** maps (XP mult: **${xpMult >= 1000 ? this.prettify(xpMult) : xpMult}x**)`;
    
    const leaders = await getLeaderboard.call(this, query, kcgmm, mapListId, guild, game);
    const leader = leaders.find(v => v.resultUser.user_id === member.id);
    if(leader) {
        const index = leaders.indexOf(leader);
        if(index >= 0) {
            str += `\nYour leaderboard rank is **#${index + 1}**`;
            if(index === 0) {
                const roleId = this.bot.getRoleId(guild.id, 'CHAMPION_OF_KC');
                if(roleId) {
                    str += `\nYou are a <@&${roleId}>`;
                }
            }
            else {
                const playerAboveIndex = index - 1;
                const playerAbove = leaders[playerAboveIndex];
                const lvlDifferential = playerAbove.total.currentLevel - leader.total.currentLevel;
                if(lvlDifferential > 0) {
                    str += `\nYou're ${lvlDifferential} level${lvlDifferential === 1 ? '' : 's'} away from rank #${playerAboveIndex + 1}`;
                }
                else {
                    const xpDifferential = playerAbove.total.currentXP - leader.total.currentXP;
                    str += `\nYou're 0 levels and ${xpDifferential} XP away from rank #${playerAboveIndex + 1}`;
                }
            }
        }
    }

    return str;
}