'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */

/**
 * @typedef {object} ExpData
 * @property {number} currentXP
 * @property {number} maxXP
 * @property {number} currentLevel
 * @property {number} milestone
 * @property {number} nextMilestoneLevel
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
 * @property {number} timestamp_profile
 * @property {number} timestamp_new
 */

/**
 * @typedef {object} Db.experience_maps_custom
 * @property {number} id - Primary key
 * @property {number} id_experience_users - Db.experience_users key
 * @property {number} map_id
 * @property {number} state - 0 (selected, incomplete), 1 (complete), 2 (ignored), 3 (none)
 */

/**
 * @typedef {object} Db.experience_maps_campaign
 * @property {number} id - Primary key
 * @property {number} id_experience_users - Db.experience_users key
 * @property {string} game_uid - GUID of the map
 * @property {number} state - 0 (selected, incomplete), 1 (complete), 2 (ignored), 3 (none)
 */

/**
 * @typedef {object} Db.experience_maps_markv
 * @property {number} id - Primary key
 * @property {number} id_experience_users - Db.experience_users key
 * @property {string} seed - seed of the Mark V map
 * @property {number} state - 0 (selected, incomplete), 1 (complete), 2 (ignored), 3 (none)
 */


import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import seedrandom from 'seedrandom';
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';
import { SQLUtil } from '../kc/SQLUtil.js';

import { CustomManager, getMapsCompleted } from './Experience/CustomManager.js';
import { CampaignManager } from './Experience/CampaignManager.js';
import { MarkVManager } from './Experience/MarkVManager.js';

const COOLDOWN_TIME = 1000;
const DEBUG_NO_COOLDOWN = false;
const XP_TO_NEXT_LEVEL = 600; //2000 XP to level 2.
const XP_INCREASE_PER_LEVEL = 200;

export default class Experience extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);
        this.commands = ['exp', 'mod_exp'];

        this.games = ['cw4', 'pf', 'cw3', 'cw2', 'cw1'];
        this.expBarLength = 40;
        this.expBarLeadersLength = 26;
        this.dots = ['⣀', '⣄', '⣤', '⣦', '⣶', '⣷', '⣿'];
        this.managers = {
            custom: new CustomManager(this),
            campaign: new CampaignManager(this),
            markv: new MarkVManager(this),
        }
        this.symbols = ["", "K", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "D"];

        /** @type {KCGameMapManager|null} */
        this.kcgmm = null;
        /** @type {import('./Champion.js').default|null} */
        this.champion = null;

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
                game VARCHAR(16) NOT NULL,
                timestamp_profile BIGINT UNSIGNED NOT NULL,
                timestamp_new BIGINT UNSIGNED NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps_custom (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                map_id MEDIUMINT UNSIGNED NOT NULL,
                state TINYINT(2) NOT NULL,
                timestamp_claimed BIGINT UNSIGNED NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps_campaign (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                game_uid VARCHAR(128) BINARY NOT NULL,
                state TINYINT(2) NOT NULL,
                timestamp_claimed BIGINT UNSIGNED NOT NULL
             )`);
            await query(`CREATE TABLE IF NOT EXISTS experience_maps_markv (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_experience_users INT UNSIGNED NOT NULL,
                seed VARCHAR(128) BINARY NOT NULL,
                state TINYINT(2) NOT NULL,
                timestamp_claimed BIGINT UNSIGNED NOT NULL
             )`);
        }).catch(logger.error);

        this.bot.sql.transaction(async query => {
            await query('ALTER TABLE experience_users ADD COLUMN timestamp_profile BIGINT UNSIGNED NOT NULL').catch(() => {});
            await query('ALTER TABLE experience_users ADD COLUMN timestamp_new BIGINT UNSIGNED NOT NULL').catch(() => {});
            await query('ALTER TABLE experience_maps_custom ADD COLUMN timestamp_claimed BIGINT UNSIGNED NOT NULL').catch(() => {});
            await query('ALTER TABLE experience_maps_campaign ADD COLUMN timestamp_claimed BIGINT UNSIGNED NOT NULL').catch(() => {});
            await query('ALTER TABLE experience_maps_markv ADD COLUMN timestamp_claimed BIGINT UNSIGNED NOT NULL').catch(() => {});
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @returns {boolean}
     */
    interactionPermitted(interaction, guild, member) {
        if(!interaction.isChatInputCommand()) return false;

        const subcommandName = interaction.options.getSubcommand();
        switch(subcommandName) {
            case 'register':
            case 'leaderboard':
            case 'profile':
            case 'new':
            case 'info':
            case 'ignore':
            case 'unignore':
            case 'ignorelist': {
                return true;
            }
            case 'message':
            case 'rename': {
                const roleId = this.bot.getRoleId(guild.id, "MODERATOR");
                if(roleId == null) return false;
                if(member.roles.cache.has(roleId)) return true;
                return false;
            }
        }

        return false;
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel | Discord.ThreadChannel} channel
     */
    async incomingInteraction(interaction, guild, member, channel) {
        if(!interaction.isChatInputCommand()) return;
        
        if(this.kcgmm == null || this.champion == null) {
            logger.error("Not initialized.");
            return;
        };

        const subcommandName = interaction.options.getSubcommand();
        switch(subcommandName) {
            case 'register': {
                let game = interaction.options.getString('game', true);
                let username = interaction.options.getString('username', true)?.trim();
                if(username.indexOf('[M]') > -1) {
                    await interaction.reply({ content: 'Your leaderboard name cannot contain [M].' }).catch(logger.error);
                    return;
                }
                if(username.indexOf('`') > -1 || username.indexOf('&') > -1 || username.indexOf('?') > -1 || username.indexOf('=') > -1) {
                    await interaction.reply({ content: 'One or more disallowed characters used in leaderboard name.' }).catch(logger.error);
                    return;
                }
                if(username.length > 40) {
                    await interaction.reply({ content: 'The chosen leaderboard name is too long.' }).catch(logger.error);
                    return;
                }
                return this.register(interaction, guild, member, game, username);
            }
            case 'leaderboard': {
                let game = interaction.options.getString('game', true);
                return this.leaderboard(interaction, guild, member, game, this.kcgmm, this.champion);
            }
            case 'message': {
                let game = interaction.options.getString('game', true);
                return this.message(interaction, guild, channel, game, this.kcgmm, this.champion);
            }
            case 'profile': {
                let game = interaction.options.getString('game', true);
                let dm = interaction.options.getBoolean('dm');
                let noinstructions = interaction.options.getBoolean('noinstructions');
                return this.profile(interaction, guild, member, game, this.kcgmm, dm??false, noinstructions??false);
            }
            case 'new': {
                let game = interaction.options.getString('game', true);
                let maps = interaction.options.getInteger('maps');
                let dm = interaction.options.getBoolean('dm');
                let nopriority = interaction.options.getBoolean('nopriority');
                let noinstructions = interaction.options.getBoolean('noinstructions');

                maps = maps ?? 6;
                if(maps > 6) maps = 6;
                if(maps < 1) maps = 1;
                return this.newMaps(interaction, guild, member, game, this.kcgmm, maps, dm??false, noinstructions??false, nopriority??false);
            }
            case 'rename': {
                let game = interaction.options.getString('game', true);
                let user = interaction.options.getUser('user', true);
                let name = interaction.options.getString('name', true);
                return this.rename(interaction, guild, game, user.id, name);
            }
            case 'info': {
                return this.info(interaction);
            }
            case 'ignore':
            case 'unignore': {
                let game = interaction.options.getString('game', true);
                let map = subcommandName === 'ignore' ? interaction.options.getString('map', true) : interaction.options.getInteger('map', true);
                let map2 = interaction.options.getInteger('map2');
                let map3 = interaction.options.getInteger('map3');
                let map4 = interaction.options.getInteger('map4');
                let map5 = interaction.options.getInteger('map5');

                let maps = []
                let rest = `${map}`.indexOf('rest') > -1;

                let map1 = Math.floor(+map);
                if(Number.isFinite(map1) && map1 > 0) maps.push(map1);
                if(map2 != null && Number.isFinite(map2) && map2 > 0) maps.push(map2);
                if(map3 != null && Number.isFinite(map3) && map3 > 0) maps.push(map3);
                if(map4 != null && Number.isFinite(map4) && map4 > 0) maps.push(map4);
                if(map5 != null && Number.isFinite(map5) && map5 > 0) maps.push(map5);

                if(maps.length <= 0 && !rest) {
                    await interaction.reply(this.bot.locale.category('experience', 'err_map_id_invalid'));
                    return;
                }

                if(subcommandName === 'ignore')
                    return this.ignore(interaction, guild, member, game, maps, true, rest ? { rest, kcgmm: this.kcgmm } : undefined);
                else
                    return this.ignore(interaction, guild, member, game, maps, false, rest ? { rest, kcgmm: this.kcgmm } : undefined);
            }
            case 'ignorelist': {
                let game = interaction.options.getString('game', true);
                return this.ignorelist(interaction, guild, member, game);
            }
        }
    }

    /**
     * 
     * @returns {RESTPostAPIApplicationCommandsJSONBody[]}
     */
    getSlashCommands() {
        return [
            new SlashCommandBuilder()
            .setName('exp')
            .setDescription('Collection of Experience related commands.')
            .addSubcommand(subcommand =>
                subcommand.setName('register')
                    .setDescription('Register your in-game name for Experience related bot features.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game you wish to register your in-game name for.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addStringOption(option =>
                        option.setName('username')
                            .setDescription('The name you use on the in-game leaderboards. Case sensitive!')
                            .setRequired(true)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('leaderboard')
                    .setDescription('Display the Exp leaderboard for a given game. Leaderboards are also pinned in #bot-commands!')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to display the current Experience leaderboard for.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('profile')
                    .setDescription('Display your current Experience profile and maps left to complete.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to display your profile for.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addBooleanOption(option =>
                        option.setName('dm')
                            .setDescription('Set to True if you want a copy of the message to be sent to you in DM\'s.')
                    ).addBooleanOption(option =>
                        option.setName('noinstructions')
                            .setDescription('Set to True if the instruction section of the message should be omitted.')
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('new')
                    .setDescription('Claim experience from maps completed in the current round, and generate more maps to beat.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to claim and get new maps from.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addIntegerOption(option =>
                        option.setName('maps')
                            .setDescription('The maximum number of custom maps to generate for the next round, between 1 and 6. Default is 6.')
                    ).addBooleanOption(option =>
                        option.setName('dm')
                            .setDescription('Set to True if you want a copy of the message to be sent to you in DM\'s.')
                    ).addBooleanOption(option =>
                        option.setName('nopriority')
                            .setDescription('Set to True to disable priority of highly rated maps. This will give only truly random picks.')
                    ).addBooleanOption(option =>
                        option.setName('noinstructions')
                            .setDescription('Set to True if the instruction section of the message should be omitted.')
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('info')
                    .setDescription('View information about what Experience is, and how to get started.')
            ).addSubcommand(subcommand =>
                subcommand.setName('ignore')
                    .setDescription('Ignore map(s). Ignored maps will not show up when generating new maps until unignored.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to claim and get new maps from.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addStringOption(option =>
                        option.setName('map')
                            .setDescription('The map ID to ignore. Type `rest` to ignore your remaining uncomplete Experience maps.')
                            .setRequired(true)
                    ).addIntegerOption(option =>
                        option.setName('map2')
                            .setDescription('Additional map ID to ignore')
                    ).addIntegerOption(option =>
                        option.setName('map3')
                            .setDescription('Additional map ID to ignore')
                    ).addIntegerOption(option =>
                        option.setName('map4')
                            .setDescription('Additional map ID to ignore')
                    ).addIntegerOption(option =>
                        option.setName('map5')
                            .setDescription('Additional map ID to ignore')
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('unignore')
                    .setDescription('Ungnore map(s). Unignoring maps will make them show up again when generating new maps.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to claim and get new maps from.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addIntegerOption(option =>
                        option.setName('map')
                            .setDescription('The map ID to unignore.')
                            .setRequired(true)
                    ).addIntegerOption(option =>
                        option.setName('map2')
                            .setDescription('Additional map ID to unignore')
                    ).addIntegerOption(option =>
                        option.setName('map3')
                            .setDescription('Additional map ID to unignore')
                    ).addIntegerOption(option =>
                        option.setName('map4')
                            .setDescription('Additional map ID to unignore')
                    ).addIntegerOption(option =>
                        option.setName('map5')
                            .setDescription('Additional map ID to unignore')
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('ignorelist')
                    .setDescription('Display a list of all the maps you\'ve ignored in Experience.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to display the ignored maps from.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    )
            ).toJSON(),
            new SlashCommandBuilder()
            .setName('mod_exp')
            .setDescription('[Mod] Collection of Experience related commands.')
            .setDefaultMemberPermissions('0')
            .addSubcommand(subcommand =>
                subcommand.setName('message')
                    .setDescription('[Mod] Build or rebuild an automaticaly updating Exp leaderboard message for a given game.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to build the autoupdating message for. This will detach the previous message, if any.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('rename')
                    .setDescription('[Mod] Change a user\'s registered leaderboard name for a given game.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to change the user\'s name for.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addUserOption(option =>
                        option.setName('user')
                            .setDescription('The user to change the name of.')    
                            .setRequired(true)
                    ).addStringOption(option =>
                        option.setName('name')
                            .setDescription('The chosen user\'s new desired leaderboard name.')    
                            .setRequired(true)
                    )
            ).toJSON(),
        ]
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
                    text: '/exp'
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








    //INTERACTION BASED COMMANDS START HERE

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {string} game
     * @param {string} name
     */
    register(interaction, guild, member, game, name) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.experience_users} */
            var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_id = ? AND user_name = ? FOR UPDATE`, [game, member.id, name])).results[0];
            if(resultUsers != null) {
                await interaction.editReply(this.bot.locale.category('experience', 'already_registered_with_this_name', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'));
                return;
            }

            /** @type {Db.experience_users} */
            var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_name = ? FOR UPDATE`, [game, name])).results[0];
            if(resultUsers != null) {
                await interaction.editReply(this.bot.locale.category('experience', 'name_taken', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'));
                return;
            }

            /** @type {Db.experience_users} */
            var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_id = ? FOR UPDATE`, [game, member.id])).results[0];
            if(resultUsers != null) {
                await interaction.editReply(this.bot.locale.category('experience', 'already_registered_with_other_name', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'));
                return;
            }

            const message = await interaction.editReply({ content: this.bot.locale.category('experience', 'register_confirm', name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown') });
            const collector = message.createReactionCollector({
                time: 1000 * 60 * 10,
            })

            collector.on('collect', async (reaction, user) => {
                if(message.member && user.id === message.member.id) return;
                await reaction.users.remove(user);
                if(user.id !== member.id) return;
                if(reaction.emoji.name !== '✅') return;

                //Additional check for changes in the interim between original message and reaction click.
                /** @type {Db.experience_users} */
                var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_id = ? FOR UPDATE`, [game, member.id])).results[0];
                if(resultUsers != null) {
                    await interaction.editReply(this.bot.locale.category('experience', 'already_registered_with_other_name', resultUsers.user_name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'));
                    await message.reactions.removeAll();
                    return;
                }

                await this.bot.sql.transaction(async query => {
                    await query(`INSERT INTO experience_users (user_id, user_name, game, timestamp_profile, timestamp_new) VALUES (?, ?, ?, ?, ?)`, [member.id, name, game, 0, 0]);
                    await interaction.editReply(this.bot.locale.category('experience', 'register_success', name, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown', game));
                    await message.reactions.removeAll();
                }).catch(logger.error)
            });

            collector.on('end', async () => {
                await message.reactions.removeAll();
            });

            await message.react('✅');
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {string} game
     * @param {KCGameMapManager} kcgmm
     * @param {import('./Champion.js').default} champion
     */
    leaderboard(interaction, guild, member, game, kcgmm, champion) {
        this.bot.sql.transaction(async query => {
            const mapListId = getMapListId.call(this, kcgmm, game);
            if(mapListId == null) {
                await interaction.reply(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'));
                return;
            }

            await interaction.deferReply();

            const embed = await getLeaderboardEmbed.call(this, query, kcgmm, mapListId, guild, game, member);
            await interaction.editReply({embeds: [embed]}).catch(logger.error);
        }).then(async () => {
            await this.loop(guild, kcgmm, champion);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     * @param {string} game 
     * @param {KCGameMapManager} kcgmm
     * @param {import('./Champion.js').default} champion
     */
    message(interaction, guild, channel, game, kcgmm, champion) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            let message = await channel.send({embeds: [{description: "..."}]});

            await query(`DELETE FROM experience_messages WHERE guild_id = '${guild.id}' AND game = '${game}'`);
            await query(`INSERT INTO experience_messages (guild_id, game, channel_id, message_id)
                VALUES ('${guild.id}', '${game}', '${message.channel.id}', '${message.id}')`);
        }).then(async () => {
            await this.loop(guild, kcgmm, champion);
            await interaction.editReply('Autoupdating message created.');
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {string} game
     * @param {KCGameMapManager} kcgmm
     * @param {boolean} dm
     * @param {boolean} noinstructions
     */
    profile(interaction, guild, member, game, kcgmm, dm, noinstructions) {
        let embed = getEmbedTemplate(member);

        this.bot.sql.transaction(async query => {
            embed.fields = [];

            let emotes = await SQLUtil.getEmotes(this.bot.sql, guild.id) ?? {};
            const emote = emotes[game]||':game_die:';

            embed.color = KCUtil.gameEmbedColors[game];

            const mapListId = getMapListId.call(this, kcgmm, game);
            if(mapListId == null) {
                await interaction.reply("Failed to retrieve map list.");
                return;
            }

            let field = {
                name: '...',
                value: '...',
                inline: false,
            }

            let fieldReferences = {
                name: emote + ' References',
                value: '',
                inline: false
            }
            /** @type {string[]} */
            let fieldReferencesValueArr = [];
            let rankMapCount = 1;

            await interaction.deferReply();

            /** @type {Db.experience_users} */
            let resultUsers = (await query(`SELECT * FROM experience_users
                                            WHERE user_id = '${member.id}' AND game = '${game}'`)).results[0];

            if(resultUsers == null) {
                let expData = getExpDataFromTotalExp(0);
                field.name = getFormattedXPBarString.call(this, emote, expData, this.expBarLength);

                field.value = Bot.Util.getSpecialWhitespace(3);
                field.value += this.bot.locale.category('experience', 'embed_not_registered_1', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown');
                field.value = Bot.Util.getSpecialWhitespace(3);
                field.value += this.bot.locale.category('experience', 'embed_not_registered_2', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown');
            }
            else {
                const now = Date.now();
                const remaining = now - resultUsers.timestamp_profile;
                if(!DEBUG_NO_COOLDOWN && remaining < COOLDOWN_TIME) {
                    await interaction.editReply(`This command is on cooldown. You can use it again in ${Math.ceil((COOLDOWN_TIME - remaining) / 1000)} seconds.`);
                    return;
                }
                await query(`UPDATE experience_users SET timestamp_profile = ? WHERE id = ?`, [now, resultUsers.id]);

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

                embed.description = await getProfileInfoString.call(this, {totalCompletedNew: totalCompleted}, resultUsers, query, kcgmm, mapListId, guild, member, game);

                let expData = getExpDataFromTotalExp(totalExp);

                field.name = getFormattedXPBarString.call(this, emote, expData, this.expBarLength);

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
                str += '\n';
                {
                    for(let map of data_custom.selectedMaps.unfinished) {
                        let data = this.managers.custom.getMapClaimString(map, kcgmm, totalCompleted, rankMapCount);
                        str += `${data.str} \n`;
                        if(data.rankStr != null) fieldReferencesValueArr.push(`${data.sup} ${data.rankStr}`);
                        rankMapCount = data.rankMapCount;
                    }
                }
                for(let map of data_campaign.selectedMaps.unfinished)
                    str += this.managers.campaign.getMapClaimString(map, totalCompleted) + '\n';
                for(let map of data_markv.selectedMaps.unfinished)
                    str += this.managers.markv.getMapClaimString(map, totalCompleted) + '\n';
                str = str.substring(0, str.length - 1);
                
                field.value = str;
                field.name += ' ' + resultUsers.user_name;
            }

            embed.fields.push(field);
            if(fieldReferencesValueArr.length > 0) {
                fieldReferences.value = `Bonus XP for being highest rated from maps uploaded in the same month:\n${fieldReferencesValueArr.join(' | ')}`;
                embed.fields.push(fieldReferences);
            }
            
            let fieldInstructions = {
                name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
                value: this.bot.locale.category('experience', 'embed_instructions_value', game == null ? '[game]' : game),
                inline: false,
            }
            if(!noinstructions) embed.fields.push(fieldInstructions);
            await interaction.editReply({ embeds:[embed] });
            if(dm) {
                fieldInstructions.value = `${this.bot.locale.category('experience', 'embed_dm_value')}\n${fieldInstructions.value}`;
                member.createDM().then(dm => {
                    return dm.send({ embeds: [embed] });
                }).catch(logger.error);
            }
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {string} game
     * @param {KCGameMapManager} kcgmm
     * @param {number} customMapCount
     * @param {boolean} dm
     * @param {boolean} noinstructions
     * @param {boolean} nopriority
     */
    newMaps(interaction, guild, member, game, kcgmm, customMapCount, dm, noinstructions, nopriority) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            //Fetch current user
            /** @type {Db.experience_users} */
            let resultUsers = (await query(`SELECT * FROM experience_users
                WHERE user_id = '${member.id}' AND game = '${game}' FOR UPDATE`)).results[0];

            //Get emote for this game
            let emote = await SQLUtil.getEmote(this.bot.sql, guild.id, game) ?? ':game_die:';

            //Exit if user is not registered
            if(resultUsers == null) {
                await interaction.editReply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown'));
                return;
            }

            const now = Date.now();
            const remaining = now - resultUsers.timestamp_new;
            if(!DEBUG_NO_COOLDOWN && remaining < COOLDOWN_TIME) {
                await interaction.editReply(`This command is on cooldown. You can use it again in ${Math.ceil((COOLDOWN_TIME - remaining) / 1000)} seconds.`);
                return;
            }
            await query(`UPDATE experience_users SET timestamp_new = ? WHERE id = ?`, [now, resultUsers.id]);

            const mapListArray = getMapListArray.call(this, kcgmm, game);
            const mapListId = getMapListId.call(this, kcgmm, game);
            if(mapListArray == null || mapListId == null) {
                await interaction.editReply(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'));
                return;
            }

            let _selected = 0;
            const data_campaign = await this.managers.campaign.newMaps(query, kcgmm, resultUsers, now);
            _selected += data_campaign.newSelectedMaps.finished.length + data_campaign.newSelectedMaps.unfinished.length;
            const data_markv = await this.managers.markv.newMaps(query, kcgmm, resultUsers, now);
            _selected += data_markv.newSelectedMaps.finished.length + data_markv.newSelectedMaps.unfinished.length;
            const data_custom = await this.managers.custom.newMaps(query, kcgmm, resultUsers, now, mapListArray, mapListId, _selected, customMapCount, nopriority);

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

            
            let embed = getEmbedTemplate(member);
            embed.color = KCUtil.gameEmbedColors[game];
            embed.description = await getProfileInfoString.call(this, {totalCompletedOld, totalCompletedNew: totalCompletedNew}, resultUsers, query, kcgmm, mapListId, guild, member, game);

            embed.fields = [];
            
            let fieldXp = {
                name: emote + ' ',
                value: '',
                inline: false
            }

            let fieldReferences = {
                name: emote + ' References',
                value: '',
                inline: false
            }
            /** @type {string[]} */
            let fieldReferencesValueArr = [];
            let rankMapCount = 1;
            
            if(expDataOld.currentLevel !== expDataNew.currentLevel || expDataOld.currentXP !== expDataNew.currentXP) {
                fieldXp.name += this.bot.locale.category('experience', 'embed_results_title_1_1');
                fieldXp.value += `\`\`\`${expBarOld}\`\`\``;
            }
            else fieldXp.name += this.bot.locale.category('experience', 'embed_results_title_1');
            fieldXp.value += `\`\`\`${expBarNew}\`\`\``;

            let fieldNewMaps = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_2', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'),
                value: '',
                inline: false
            };
            {
                for(let map of data_custom.newSelectedMaps.unfinished) {
                    let data = this.managers.custom.getMapClaimString(map, kcgmm, totalCompletedNew, rankMapCount);
                    fieldNewMaps.value += `${data.str} \n`;
                    if(data.rankStr != null) fieldReferencesValueArr.push(`${data.sup} ${data.rankStr}`);
                    rankMapCount = data.rankMapCount;
                }
            }
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

            {
                for(let map of data_custom.newSelectedMaps.finished) {
                    let data = this.managers.custom.getMapClaimString(map, kcgmm, totalCompletedNew, rankMapCount, true);
                    fieldBeatenMaps.value += `${data.str} \n`;
                    if(data.rankStr != null) fieldReferencesValueArr.push(`${data.sup} ${data.rankStr}`);
                    rankMapCount = data.rankMapCount;
                }
            }
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
            if(fieldReferencesValueArr.length > 0) {
                fieldReferences.value = `Bonus XP for being highest rated from maps uploaded in the same month:\n${fieldReferencesValueArr.join(' | ')}`;
                embed.fields.push(fieldReferences);
            }
            if(!noinstructions) embed.fields.push(fieldInstructions);

            await interaction.editReply({ embeds:[embed] });
            if(dm) {
                fieldInstructions.value = `${this.bot.locale.category('experience', 'embed_dm_value')}\n${fieldInstructions.value}`;
                member.createDM().then(dm => {
                    return dm.send({ embeds: [embed] });
                }).catch(logger.error);
            }
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {string} game
     * @param {string} id
     * @param {string} userName
     */
    rename(interaction, guild, game, id, userName) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.experience_users} */
            var resultUsers = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_id = ? FOR UPDATE`, [game, id])).results[0];

            if(!resultUsers) {
                await interaction.editReply(this.bot.locale.category('experience', 'rename_failed_not_registered'));
                return;
            }

            /** @type {Db.experience_users} */
            var resultUsersExists = (await query(`SELECT * FROM experience_users WHERE game = ? AND user_name = ?`, [game, userName])).results[0];
            if(resultUsersExists) {
                await interaction.editReply(`Failed to change name. A user with the name \`${userName}\` is already registered for ${KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'}.`);
                return;
            }

            await query(`UPDATE experience_users SET user_name = ? WHERE id = ?`, [userName, resultUsers.id]);

            await interaction.editReply(this.bot.locale.category('experience', 'rename_successful', resultUsers.user_name, userName, KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'));
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     */
    info(interaction) {
        const embed = getEmbedTemplate();

        embed.title = this.bot.locale.category('experience', 'intro_name');
        embed.description = this.bot.locale.category('experience', 'intro_value');

        interaction.reply({ embeds: [embed] }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {string} game 
     * @param {number[]} mapIds
     * @param {boolean} ignore
     * @param {{rest: boolean, kcgmm: KCGameMapManager}=} opts
     */
    ignore(interaction, guild, member, game, mapIds, ignore, opts) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.experience_users} */
            var resultUsers = (await query(`SELECT * FROM experience_users
                WHERE game = '${game}' AND user_id = '${member.id}' FOR UPDATE`)).results[0];
            
            if(!resultUsers) {
                await interaction.editReply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown'));
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
                //3 - none
                /** @type {string[][]} */
                const mapsDb = [[], [], [], []];
                /** @type {string[]} */
                const mapsNewIgnored = [];
                for(let mapId of mapIds) {
                    /** @type {Db.experience_maps_custom|undefined} */
                    var resultMapsCustom = (await query(`SELECT * FROM experience_maps_custom
                    WHERE id_experience_users = ? AND map_id = ? FOR UPDATE`, [resultUsers.id, mapId])).results[0];

                    if(resultMapsCustom) {
                        mapsDb[resultMapsCustom.state].push(`#${mapId}`);
                    }

                    if(!resultMapsCustom || (resultMapsCustom && (resultMapsCustom.state === 0 || resultMapsCustom.state === 3))) {
                        mapsNewIgnored.push(`#${mapId}`);

                        if(resultMapsCustom) {
                            await query(`UPDATE experience_maps_custom SET state = ?, timestamp_claimed = ? WHERE id = ?`, [2, Date.now(), resultMapsCustom.id]);
                        }
                        else {
                            await query(`INSERT INTO experience_maps_custom (id_experience_users, map_id, state, timestamp_claimed)
                                VALUES (?, ?, ?, ?)`, [resultUsers.id, mapId, 2, Date.now()]);
                        }
                    }
                }

                if(mapsNewIgnored.length > 0) str += `${this.bot.locale.category('experience', 'map_ignored', mapsNewIgnored.join(', '), game, KCLocaleManager.getDisplayNameFromAlias("game", game))}\n`;
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
                    WHERE id_experience_users = ? AND map_id = ? AND state = ? FOR UPDATE`, [resultUsers.id, mapId, 2])).results[0];

                    if(resultMapsCustom == null) {
                        mapsNotIgnoring.push(`#${mapId}`);
                        continue;
                    }

                    mapsUnignored.push(`#${mapId}`);
                    await query(`UPDATE experience_maps_custom SET state = ?, timestamp_claimed = ? WHERE id = ?`, [3, Date.now(), resultMapsCustom.id]);
                }

                if(mapsNotIgnoring.length > 0) str += `${this.bot.locale.category('experience', 'not_ignoring_map', mapsNotIgnoring.join(', '))}\n`;
                if(mapsUnignored.length > 0) str += `${this.bot.locale.category('experience', 'map_unignored', mapsUnignored.join(', '), game, KCLocaleManager.getDisplayNameFromAlias("game", game))}\n`;
                if(str.length === 0) str = 'Nothing happened.';
            }

            await interaction.editReply(str);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {string} game 
     */
    ignorelist(interaction, guild, member, game) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.experience_users} */
            var resultUsers = (await query(`SELECT * FROM experience_users
                WHERE game = '${game}' AND user_id = '${member.id}'`)).results[0];
            
            if(!resultUsers) {
                await interaction.editReply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown'));
                return;
            }

            /** @type {Db.experience_maps_custom[]} */
            var resultsMapsCustom = (await query(`SELECT * FROM experience_maps_custom
            WHERE id_experience_users = '${resultUsers.id}' AND state = '2'`)).results;


            resultsMapsCustom.sort((a, b) => a.map_id - b.map_id);

            let str = this.bot.locale.category('experience', 'maps_ignored');
            str += ' ';
            str += resultsMapsCustom.map(v => `\`#${v.map_id}\``).join(', ');

            await interaction.editReply(str);
        }).catch(logger.error);
    }
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
    let currentLevel = 1;
    let xpToNextLevel = XP_TO_NEXT_LEVEL;
    let xpIncreasePerLevel = XP_INCREASE_PER_LEVEL;
    let totalXp = exp;

    while(true) {
        if(totalXp - xpToNextLevel < 0)
            break;

        totalXp = totalXp - xpToNextLevel;
        currentLevel += 1;
        xpToNextLevel += xpIncreasePerLevel;
    }
    
    if(currentLevel < 100) return {
        currentXP: totalXp,
        maxXP: xpToNextLevel,
        currentLevel: currentLevel,
        milestone: 0,
        nextMilestoneLevel: 100,
    }


    //milestone code begins
    
    //1 for 100-999, 4 for 1000-9999, 7 for 10000-99999 etc.
    let milestone = (Math.floor(Math.log10(currentLevel)) - 2) * 3 + 1;
    //3819 becomes 1000, 48201 becomes 10000, 281 becomes 100 etc.
    let lvlStart = Math.pow(10, Math.floor(Math.log10(currentLevel)));
    let lvlEnd = 0;

    //milestone brackets are 100, 200, 500, 1000, 2000, 5000, 10000, etc.
    //i separate them into groups of three then determine the one we're in below
    let firstLevelDigit = +(currentLevel+'')[0];
    if(firstLevelDigit >= 5) {
        milestone += 2;
        lvlEnd = lvlStart * 10;
        lvlStart *= 5;
    }
    else if(firstLevelDigit >= 2) {
        milestone += 1;
        lvlEnd = lvlStart * 5;
        lvlStart *= 2;
    }
    else {
        lvlEnd = lvlStart * 2;
    }


    //calculate our current total XP from milestone level start to our current level
    let level = 1;
    xpToNextLevel = XP_TO_NEXT_LEVEL;
    xpIncreasePerLevel = XP_INCREASE_PER_LEVEL;
    let expCur = 0;
    while(true) {
        if(level >= currentLevel) break;
        if(level >= lvlStart) expCur += xpToNextLevel;
        level += 1;
        xpToNextLevel += xpIncreasePerLevel;
    }

    //calculate our required total XP from milestone level start to milestone level end
    level = 1;
    xpToNextLevel = XP_TO_NEXT_LEVEL;
    xpIncreasePerLevel = XP_INCREASE_PER_LEVEL;
    let expEnd = 0;
    while(true) {
        if(level >= lvlEnd) break;
        if(level >= lvlStart) expEnd += xpToNextLevel;
        level += 1;
        xpToNextLevel += xpIncreasePerLevel;
    }

    return {
        currentXP: expCur,
        maxXP: expEnd,
        currentLevel: currentLevel,
        milestone,
        nextMilestoneLevel: lvlEnd
    }
}

/**
 * 
 * @param {Discord.GuildMember=} member 
 * @returns {Discord.APIEmbed}
 */
function getEmbedTemplate(member) {
    /** @type {Discord.APIEmbed} */
    let embed = {
        color: 5559447
    }
    if(member) {
        embed.author = {
            name: member.nickname ?? member.displayName ?? member.user.username,
            icon_url: member.user.avatarURL() || member.user.defaultAvatarURL
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
        //if(!guild.members.cache.get(resultUser.user_id)) continue;

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
 * @returns {Promise<Discord.APIEmbed>}
 */
async function getLeaderboardEmbed(query, kcgmm, mapListId, guild, game, member) {
    const leaders = await getLeaderboard.call(this, query, kcgmm, mapListId, guild, game);

    /** @type {Db.experience_users|null} */
    let resultUsers = member == null ? null : (await query(`SELECT * FROM experience_users
        WHERE game = '${game}' and user_id = '${member.id}'`)).results[0];
    
    let emote = await SQLUtil.getEmote(this.bot.sql, guild.id, game) ?? ':game_die:';

    let embed = getEmbedTemplate(member);
    embed.color = KCUtil.gameEmbedColors[game];
    embed.description = `${emote} ${this.bot.locale.category('experience', 'leaderboard_title', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')}\n`;
    let msgStr = '';

    let selfFound = false;
    for(let i = 0; i < Math.min(9, leaders.length); i++) {
        let leader = leaders[i];
        let leaderMember = guild.members.resolve(leader.resultUser.user_id);
        if(i === 0 && leaders.length > 2) this.cache.set(guild.id, `champion_${game}`, leader.resultUser.user_id);

        if(member) {
            if(i === 0 && leaders.length > 2) msgStr += '🏆 ';
            else msgStr += '🔹 ';
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
 * @param {{totalCompletedNew: number, totalCompletedOld?: number}} totals
 * @param {Db.experience_users} resultUsers
 * @param {SQLWrapper.Query} query
 * @param {KCGameMapManager} kcgmm 
 * @param {Discord.Collection<number, KCGameMapManager.MapData>} mapListId
 * @param {Discord.Guild} guild
 * @param {Discord.GuildMember} member
 * @param {string} game
 * @returns {Promise<string>}
 */
async function getProfileInfoString(totals, resultUsers, query, kcgmm, mapListId, guild, member, game) {
    const xpMultNew = Math.ceil(this.getExpMultiplier(totals.totalCompletedNew) * 100)/100;
    const xpMultOld = totals.totalCompletedOld == null ? null : Math.ceil(this.getExpMultiplier(totals.totalCompletedOld) * 100)/100;
    let str = `Your leaderboards name is \`${resultUsers.user_name}\`\nYou've completed ${totals.totalCompletedOld != null ? `${totals.totalCompletedOld} -> ` : ''}**${totals.totalCompletedNew}** maps (XP mult: ${xpMultOld != null ? `${xpMultOld >= 1000 ? this.prettify(xpMultOld) : xpMultOld}x -> ` : ''}**${xpMultNew >= 1000 ? this.prettify(xpMultNew) : xpMultNew}x**)`;
    
    const leaders = await getLeaderboard.call(this, query, kcgmm, mapListId, guild, game);
    const leader = leaders.find(v => v.resultUser.user_id === member.id);
    if(leader) {
        const index = leaders.indexOf(leader);
        if(index >= 0) {
            str += `\nYour leaderboard rank is **#${index + 1}**`;
            if(index === 0) {
                const roleId = this.bot.getRoleId(guild.id, 'CHAMPION_OF_KC');
                if(roleId) {
                    str += `. You are a <@&${roleId}>`;
                }
            }
            else {
                const playerAboveIndex = index - 1;
                const playerAbove = leaders[playerAboveIndex];
                const lvlDifferential = playerAbove.total.currentLevel - leader.total.currentLevel;
                if(lvlDifferential > 0) {
                    str += `, ${lvlDifferential} level${lvlDifferential === 1 ? '' : 's'} away from #${playerAboveIndex + 1}`;
                }
                else {
                    const xpDifferential = playerAbove.total.currentXP - leader.total.currentXP;
                    str += `, ${xpDifferential} XP away from #${playerAboveIndex + 1}`;
                }
            }
        }
        if(leader.total.milestone <= 0) {
            str += `\n`;
        }
        else
            str += `\nYou've attained milestone rank **${KCUtil.romanize(leader.total.milestone)}**.`;
        str += ` Next milestone at level ${this.prettify(leader.total.nextMilestoneLevel)}`;
    }

    return str;
}