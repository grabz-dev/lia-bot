'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import("../kc/KCGameMapManager").MapData} KCGameMapManager.MapData} */
/** @typedef {import("../kc/KCGameMapManager").MapScoreQueryData} KCGameMapManager.MapScoreQueryData} */
/** @typedef {import("../kc/KCGameMapManager").MapLeaderboard} KCGameMapManager.MapLeaderboard} */
/** @typedef {import("../kc/KCGameMapManager").MapLeaderboardEntry} KCGameMapManager.MapLeaderboardEntry} */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';
import { SQLUtil } from '../kc/SQLUtil.js';
import mysql from 'mysql';

/**
 * @typedef {object} Db.competition_main
 * @property {number} id - Primary key
 * @property {Discord.Snowflake|null} channel_id - Competition channel ID.
 * @property {number|null} time_start - Start timestamp.
 * @property {number|null} time_end - End timestamp.
 * @property {number|null} time_end_offset
 * @property {string|null} previous_competition_message_ids
 * @property {Discord.Snowflake|null} previous_competition_title_message_id
 * @property {Discord.Snowflake|null} score_tally_message_id
 * @property {Discord.Snowflake|null} current_champions_message_id
 * @property {Discord.Snowflake|null} chronom_intro_message_id
 * @property {Discord.Snowflake|null} champion_intro_message_id
 * @property {Discord.Snowflake|null} chronom_leaders_message_id
 */

/**
 * @typedef {object} Db.competition_maps
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {string} game - Game.
 * @property {string} type - Map type.
 * @property {number|null} map_id - Map ID. Not applicable to CW2 code map.
 * @property {number|null} size - CW2 code map size.
 * @property {number|null} complexity - CW2 code map complexity.
 * @property {string|null} name - CW2 code map/CW4 markv name.
 * @property {number|null} objective - CW4 objective
 * @property {number|null} timestamp - CW4 chronom timestamp
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
 * @property {string|null} name - CW2 code map/CW4 markv name.
 * @property {number|null} objective - CW4 objective
 * @property {number|null} timestamp - CW4 chronom timestamp
 */

 /**
 * @typedef {object} Db.competition_history_scores
 * @property {number} id - Primary key
 * @property {number} id_competition_history_maps - competition_history_maps key ID.
 * @property {number} user_rank - Player rank.
 * @property {Discord.Snowflake} user_id - User snowflake.
 * @property {number} time - User time.
 * @property {number|null} plays - User plays.
 * @property {number|null} score - User score. Not applicable for Particle Fleet.
 * @property {number|null} eco - CW4 eco.
 * @property {number|null} unitsBuilt - CW4 unitsBuilt.
 * @property {number|null} unitsLost - CW4 unitsLost.
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

const chronom_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "July", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default class Competition extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);
        this.commands = ['c', 'mod_c', 'admin_c'];

        this.games = ["cw4", "pf", "cw3", "cw2", "cw1"];
        this.maxScoresInTable = 8;
        this.timeOffsetHours = 24;
        this.pinManiaActive = false;

        /** @type {KCGameMapManager|null} */
        this.kcgmm = null;
        /** @type {import('./Champion.js').default|null} */
        this.champion = null;
        /** @type {import('./Map.js').default|null} */
        this.map = null;
        /** @type {import('./DMD.js').default|null} */
        this.dmd = null;

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS competition_main (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                channel_id VARCHAR(64),
                time_start BIGINT,
                time_end BIGINT,
                time_end_offset BIGINT,
                previous_competition_message_ids VARCHAR(1024),
                previous_competition_title_message_id VARCHAR(64),
                score_tally_message_id VARCHAR(64),
                current_champions_message_id VARCHAR(64),
                chronom_intro_message_id VARCHAR(64),
                champion_intro_message_id VARCHAR(64)
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
                name VARCHAR(128) BINARY,
                objective TINYINT UNSIGNED,
                timestamp BIGINT UNSIGNED
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
                name VARCHAR(128) BINARY,
                objective TINYINT UNSIGNED,
                timestamp BIGINT UNSIGNED
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_history_scores (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_competition_history_maps INT UNSIGNED NOT NULL,
                user_rank SMALLINT UNSIGNED NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                time BIGINT UNSIGNED NOT NULL,
                plays SMALLINT UNSIGNED,
                score MEDIUMINT UNSIGNED,
                eco INT,
                unitsBuilt INT,
                unitsLost INT
             )`);

            await query(`CREATE TABLE IF NOT EXISTS competition_register (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                game VARCHAR(16) NOT NULL,
                user_name VARCHAR(128) BINARY NOT NULL
             )`);

            await query(`ALTER TABLE competition_main ADD COLUMN time_end_offset BIGINT`).catch(() => {});
            await query(`ALTER TABLE competition_main ADD COLUMN previous_competition_message_ids VARCHAR(1024)`).catch(() => {});
            await query(`ALTER TABLE competition_main ADD COLUMN previous_competition_title_message_id VARCHAR(64)`).catch(() => {});
            await query(`ALTER TABLE competition_main ADD COLUMN score_tally_message_id VARCHAR(64)`).catch(() => {});
            await query(`ALTER TABLE competition_main ADD COLUMN current_champions_message_id VARCHAR(64)`).catch(() => {});
            await query(`ALTER TABLE competition_main ADD COLUMN chronom_intro_message_id VARCHAR(64)`).catch(() => {});
            await query(`ALTER TABLE competition_main ADD COLUMN champion_intro_message_id VARCHAR(64)`).catch(() => {});
            await query(`ALTER TABLE competition_main ADD COLUMN chronom_leaders_message_id VARCHAR(64)`).catch(() => {});
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);

        this.cache.set(guild.id, 'comp_maps', []);
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @returns {boolean}
     */
    interactionPermitted(interaction, guild, member) {
        const commandName = interaction.options.getSubcommand();
        switch(commandName) {
        case 'pinmania':
        case 'setchannel':
        case 'destroy':
        case 'build_tally':
        case 'end':
        case 'intro':
        case 'unregister':
        case 'add_map':
        case 'remove_map':
        case 'check':
        case 'random': {
            const roleId = this.bot.getRoleId(guild.id, "EVENT_MOD");
            if(roleId == null) return false;
            if(member.roles.cache.has(roleId)) return true;
            return false;
        }
        case 'info':
        case 'update':
        case 'register': {
            return true;
        }
        default:
            return false;
        }
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel | Discord.ThreadChannel} channel
     */
    async incomingInteraction(interaction, guild, member, channel) {
        if(this.kcgmm == null || this.champion == null || this.map == null) {
            logger.error("Not initialized.");
            return;
        };

        const commandName = interaction.options.getSubcommand();
        switch(commandName) {
        case 'pinmania':
            return this.pinMania(interaction, channel, guild);
        case 'info':
            return this.info(interaction, guild);
        case 'setchannel':
            return this.setChannel(interaction, guild, channel);
        case 'destroy':
            return this.destroy(interaction, guild);
        case 'update':
            return this.update(interaction, guild, this.kcgmm);
        case 'build_tally':
            return this.buildTally(interaction, guild, channel, this.champion);
        case 'end':
            return this.end(interaction, guild, this.kcgmm, this.champion);
        case 'intro': {
            let type = interaction.options.getString('type', true);
            if(type !== 'champion' && type !== 'chronom') return;
            return this.intro(interaction, guild, channel, type);
        }
        case 'register': {
            let game = interaction.options.getString('game', true);
            let username = interaction.options.getString('username', true)?.trim();
            if(username.indexOf('[M]') > -1) {
                await interaction.reply({ content: 'Your leaderboard name cannot contain [M].' });
                return;
            }
            if(username.indexOf('`') > -1 || username.indexOf('&') > -1 || username.indexOf('?') > -1 || username.indexOf('=') > -1) {
                await interaction.reply({ content: 'One or more disallowed characters used in leaderboard name.' });
                return;
            }
            if(username.length > 40) {
                await interaction.reply({ content: 'The chosen leaderboard name is too long.' });
                return;
            }
            return this.register(interaction, guild, member, game, username);
        }
        case 'unregister': {
            let targetUser = interaction.options.getUser('user', true);
            return this.unregister(interaction, guild, targetUser);
        }
        case 'start': {
            let dateInput = interaction.options.getString('date', true);

            const now = Date.now();
            let date = Date.parse(dateInput);
            if(Number.isNaN(date)) {
                await interaction.reply({ content: this.bot.locale.category("competition", "err_end_date_invalid") });
                return;
            }
            if(now > date) {
                await interaction.reply(this.bot.locale.category("competition", "end_date_in_past"));
                return;
            }

            return this.start(interaction, guild, now, date);
        }
        case 'addmap':
        case 'removemap': {
            let type = interaction.options.getString('type', true);
            let game = interaction.options.getString('game');
            let id = interaction.options.getInteger('id');
            let objective = interaction.options.getString('objective');
            let seed = interaction.options.getString('seed');
            let date = interaction.options.getString('date');
            let size = interaction.options.getString('size');
            let complexity = interaction.options.getString('complexity');
            let gameUID = interaction.options.getString('gameuid');

            const data = this.kcgmm.getMapQueryObjectFromCommandParameters(type, game, id, objective, seed, date, size, complexity, gameUID);
            if(data.err != null) {
                await interaction.reply({ content: data.err });
                return;
            }
            else {
                const mapQueryData = data.data;
                if(mapQueryData.game === 'cw1' && mapQueryData.gameUID != null) {
                    await interaction.reply({ content: 'This action is not supported.' });
                    return;
                }

                return this.addMap(interaction, guild, commandName, mapQueryData.game, mapQueryData, this.kcgmm);
            }
        }
        case 'check': {
            let type = interaction.options.getString('type', true);
            let game = interaction.options.getString('game');
            let id = interaction.options.getInteger('id');
            let objective = interaction.options.getString('objective');
            let seed = interaction.options.getString('seed');
            let date = interaction.options.getString('date');
            let size = interaction.options.getString('size');
            let complexity = interaction.options.getString('complexity');
            let campaign = interaction.options.getString('campaign');

            const data = this.kcgmm.getMapQueryObjectFromCommandParameters(type, game, id, objective, seed, date, size, complexity, campaign);
            if(data.err != null) {
                await interaction.reply({ content: data.err });
                return;
            }
            else {
                let mapQueryData = data.data;
                return this.mapCmd(interaction, guild, member, channel, this.kcgmm, mapQueryData.game, this.map, mapQueryData);
            }
        }
        case 'random': {
            let game = interaction.options.getString('game', true);
            return this.mapCmd(interaction, guild, member, channel, this.kcgmm, game, this.map);
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
            .setName('c')
            .setDescription('Collection of Competition related commands.')
            .addSubcommand(subcommand =>
                subcommand.setName('info')
                    .setDescription('View information about the Competition.')
            ).addSubcommand(subcommand =>
                subcommand.setName('register')
                    .setDescription('Register your in-game name for Competition related bot features.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game you wish to register your in-game name for.')
                            .setRequired(true)
                            .addChoices({ name: 'All Games', value: 'all' }, ...KCUtil.slashChoices.game)
                    ).addStringOption(option =>
                        option.setName('username')
                            .setDescription('The name you use on the in-game leaderboards. Case sensitive!')
                            .setRequired(true)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('update')
                    .setDescription('Force a manual update of the Competition score standings.')
            ).toJSON(),
            new SlashCommandBuilder()
                .setName('admin_c')
                .setDescription('[Admin] Collection of Competition related commands.')
                .setDefaultMemberPermissions('0')
                .addSubcommand(subcommand =>
                    subcommand.setName('setchannel')
                        .setDescription('[Admin] Set the competition channel.')
            ).toJSON(),
            new SlashCommandBuilder()
                .setName('mod_c')
                .setDescription('[Mod] Collection of Competition related commands.')
                .setDefaultMemberPermissions('0')
                .addSubcommand(subcommand =>
                    subcommand.setName('unregister')
                        .setDescription('[Mod] Remove a user\'s Competition registration entries.')
                        .addUserOption(option => 
                            option.setName('user')
                                .setDescription('The user to unregister from the Competition.')
                                .setRequired(true)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('start')
                        .setDescription('[Mod] Start a new Competition.')
                        .addStringOption(option => 
                            option.setName('date')
                                .setDescription('The end date for the Competition. Example date format: 2022-06-04')
                                .setRequired(true)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('destroy')
                        .setDescription('[Mod] Erase the current Competition as if it never happened.')
                ).addSubcommand(subcommand =>
                    KCUtil.fillScoreSlashCommandChoices(subcommand
                    .setName('addmap')
                    .setDescription('[Mod] Add a map to the current Competition.')
                    ),
                ).addSubcommand(subcommand =>
                    KCUtil.fillScoreSlashCommandChoices(subcommand
                    .setName('removemap')
                    .setDescription('[Mod] Remove a map from the current Competition.')
                    ),
                ).addSubcommand(subcommand =>
                    subcommand.setName('end')
                        .setDescription('[Mod] End the current Competition early, before the schedule.')
                ).addSubcommandGroup(subcommandGroup =>
                    subcommandGroup.setName('map')
                        .setDescription('[Mod] Check if a map was already featured before, or pick a map at random.')
                        .addSubcommand(subcommand => 
                            KCUtil.fillScoreSlashCommandChoices(subcommand
                            .setName('check')
                            .setDescription('[Mod] Check if a map was already featured in Competition before.')
                            ),
                        ).addSubcommand(subcommand => 
                            subcommand.setName('random')
                                .setDescription('[Mod] Pick a map at random that wasn\'t featured in a previous Competition.')
                                .addStringOption(option =>
                                    option.setName('game')
                                        .setDescription('The game to pick a random map from.')
                                        .setRequired(true)
                                        .addChoices(...KCUtil.slashChoices.game)
                                )
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('intro')
                        .setDescription('[Mod] Build an intro message to Champion of KC or Master of Chronom.')
                        .addStringOption(option =>
                            option.setName('type')
                                .setDescription('Display intro for Champion of KC or Master of Chronom?')
                                .setRequired(true)
                                .addChoices({ name: 'Champion of KC', value: 'champion' },
                                            { name: 'Master of Chronom',  value: 'chronom' })    
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('pinmania')
                        .setDescription('[Mod] Automatically re-pin the pinned messages in Competition.')
                ).toJSON()
        ]
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

            let games = game === 'all' ? this.games : [game];
            let str = '';

            for(let game of games) {
                let gameName = KCLocaleManager.getDisplayNameFromAlias("game", game) || "unknown";
        
                /** @type {Db.competition_register} */
                var resultRegister = (await query(`SELECT * FROM competition_register WHERE guild_id = ? AND user_id = ? AND game = ? AND user_name = ? FOR UPDATE`, [guild.id, member.id, game, name])).results[0];
                if(resultRegister) {
                    str += `${this.bot.locale.category("competition", "already_registered_with_this_name", name, gameName)}\n`;
                    continue;
                }
        
                /** @type {Db.competition_register} */
                var resultRegister = (await query(`SELECT * FROM competition_register WHERE guild_id = ? AND game = ? AND user_name = ? FOR UPDATE`, [guild.id, game, name])).results[0];
                if(resultRegister) {
                    str += `${this.bot.locale.category("competition", "name_taken", name, gameName)}\n`;
                    continue;
                }
        
                /** @type {Db.competition_register} */
                var resultRegister = (await query(`SELECT * FROM competition_register WHERE guild_id = ? AND user_id = ? AND game = ? FOR UPDATE`, [guild.id, member.id, game])).results[0];
                if(resultRegister) {
                    await query(`UPDATE competition_register SET user_name = ? WHERE guild_id = ? AND user_id = ? AND game = ?`, [name, guild.id, member.id, game]);
                    str += `${this.bot.locale.category("competition", "register_name_changed", resultRegister.user_name, name, gameName)}\n`;
                }
                else {
                    await query(`INSERT INTO competition_register (guild_id, user_id, game, user_name) VALUES (?, ?, ?, ?)`, [guild.id, member.id, game, name]);
                    str += `${this.bot.locale.category("competition", "register_success", name, gameName)}\n`
                }
            }

            await interaction.editReply(str);
        }).catch(logger.error);
    }
    
    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild 
     */
    info(interaction, guild) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            /** @type {Db.competition_main|null} */
            let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}'`)).results[0];
    
            if(resultMain == null || resultMain.channel_id == null) {
                await interaction.editReply(this.bot.locale.category("competition", "info_inactive"));
                return;
            }
    
            await interaction.editReply({ embeds:[getEmbedInfo.bind(this)(resultMain.channel_id)] });
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild 
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel 
     */
    setChannel(interaction, guild, channel) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.competition_main|null} */
            let resultMain = (await query(`SELECT channel_id FROM competition_main WHERE guild_id = '${guild.id}'
                FOR UPDATE`)).results[0];
    
            if(resultMain)
                await query(`UPDATE competition_main SET channel_id = '${channel.id}' WHERE guild_id = '${guild.id}'`);
            else
                await query(`INSERT INTO competition_main (guild_id, channel_id) VALUES ('${guild.id}', '${channel.id}')`);
                
            await query(`DELETE FROM competition_messages WHERE guild_id = '${guild.id}'`)
    
            await interaction.editReply(this.bot.locale.category("competition", "channel_set"));
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild 
     * @param {Discord.User} targetUser 
     */
    unregister(interaction, guild, targetUser) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.competition_register[]} */
            var resultsRegister = (await query(`SELECT * FROM competition_register WHERE guild_id = ? AND user_id = ? FOR UPDATE`, [guild.id, targetUser.id])).results;
    
            if(resultsRegister.length <= 0) {
                await interaction.editReply(this.bot.locale.category("competition", "unregister_not_registered"));
                return;
            }
    
            await query(`DELETE FROM competition_register WHERE guild_id = ? AND user_id = ?`, [guild.id, targetUser.id]);
    
            await interaction.editReply(this.bot.locale.category("competition", "unregister_success", resultsRegister.length+""));
        }).catch(logger.error);
    }
    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild 
     * @param {number} startTime 
     * @param {number} endTime 
     */
    start(interaction, guild, startTime, endTime) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.competition_main|null} */
            let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}'
                FOR UPDATE`)).results[0];
    
            if(resultMain && resultMain.time_start != null) {
                await interaction.editReply(this.bot.locale.category("competition", "already_started"));
                return;
            }
    
            if(!resultMain || resultMain.channel_id == null) {
                await interaction.editReply(this.bot.locale.category("competition", "no_channel"));
                return;
            }
    
            let channel = guild.channels.resolve(resultMain.channel_id);
            if(!channel || !(channel instanceof Discord.TextChannel)) {
                await interaction.editReply(this.bot.locale.category("competition", "channel_no_access"));
                return;
            }
    
            let timeOffset = Math.floor(1000 * 60 * 60 * this.timeOffsetHours * Math.random());
    
            await query(`UPDATE competition_main SET time_start = '${startTime}', time_end = '${endTime}', time_end_offset = '${timeOffset}'
                WHERE guild_id = '${guild.id}'`);
    
            await channel.send(this.bot.locale.category("competition", "start_message"));
            await interaction.editReply(this.bot.locale.category("competition", "start_success"));
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild 
     */
    destroy(interaction, guild) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}' FOR UPDATE`);
    
            await query(`DELETE FROM competition_messages WHERE guild_id = '${guild.id}'`);
            await query(`UPDATE competition_main SET time_start = NULL, time_end = NULL, time_end_offset = NULL WHERE guild_id = '${guild.id}'`);
            await query(`DELETE FROM competition_maps WHERE guild_id = '${guild.id}'`);
    
            this.cache.set(guild.id, 'comp_maps', []);
    
            await interaction.editReply(this.bot.locale.category("competition", "erased"));
        }).catch(logger.error);
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {'removemap'|'addmap'} type
     * @param {string} game
     * @param {KCGameMapManager.MapScoreQueryData} msqd
     * @param {KCGameMapManager} kcgmm
     */
    addMap(interaction, guild, type, game, msqd, kcgmm) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.competition_main|null} */
            let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}' FOR UPDATE`)).results[0];

            if(!resultMain || !resultMain.channel_id) {
                await interaction.editReply(this.bot.locale.category("competition", "no_channel"));
                return;
            }
            if(resultMain.time_start == null) {
                await interaction.editReply(this.bot.locale.category("competition", "addmap_not_started"));
                return;
            }

            const sqlWhere = `WHERE guild_id = ${mysql.escape(guild.id)}
            AND game = ${mysql.escape(game)}
            AND type = ${mysql.escape(msqd.type)}
            AND map_id ${msqd.id == null ? 'IS NULL' : `= ${mysql.escape(msqd.id)}`}
            AND size ${msqd.size == null ? 'IS NULL' : `= ${mysql.escape(msqd.size)}`}
            AND complexity ${msqd.complexity == null ? 'IS NULL' : `= ${mysql.escape(msqd.complexity)}`}
            AND name ${msqd.name == null ? 'IS NULL' : `= ${mysql.escape(msqd.name)}`}
            AND objective ${msqd.objective == null ? 'IS NULL' : `= ${mysql.escape(msqd.objective)}`}
            AND timestamp ${msqd.timestamp == null ? 'IS NULL' : `= ${mysql.escape(msqd.timestamp)}`}`;

            switch(type) {
            case "removemap":
                /** @type {Db.competition_maps[]} */
                var resultsMaps = (await query(`SELECT * FROM competition_maps ${sqlWhere}`)).results;

                if(resultsMaps.length <= 0) {
                    await interaction.editReply(this.bot.locale.category("competition", "removemap_not_added"));
                    return;
                }

                await query(`DELETE FROM competition_maps ${sqlWhere}`);
                
                await interaction.editReply(this.bot.locale.category("competition", "removemap_success"));
                break;
            case "addmap":
            default:
                /** @type {Db.competition_maps[]} */
                var resultsMaps = (await query(`SELECT * FROM competition_maps ${sqlWhere}`)).results;
                if(resultsMaps.length > 0) {
                    await interaction.editReply(this.bot.locale.category("competition", "addmap_already_added"));
                    return;
                }

                if(await getMapAlreadyFeaturedInPreviousCompetition(query, guild, game, msqd)) {
                    await interaction.editReply(this.bot.locale.category("competition", "addmap_already_in_history"));
                    return;
                }

                await query(`INSERT INTO competition_maps (guild_id, game, type, map_id, size, complexity, name, objective, timestamp)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`, [guild.id, game, msqd.type, msqd.id, msqd.size, msqd.complexity, msqd.name, msqd.objective, msqd.timestamp]);

                await interaction.editReply(this.bot.locale.category("competition", "addmap_success"));
                break;
            }
        }).then(() => {
            this.loop(guild, kcgmm);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {KCGameMapManager} kcgmm
     */
    update(interaction, guild, kcgmm) {
        (async () => {
            await interaction.deferReply();
            await this.loop(guild, kcgmm).catch(e => {
                interaction.editReply(this.bot.locale.category("competition", "score_update_failed")).catch(logger.error);
                logger.error(e);
            });
            await interaction.editReply(this.bot.locale.category("competition", "scores_updated"));
        })();
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     * @param {import('./Champion.js').default} champion
     */
    buildTally(interaction, guild, channel, champion) {
        interaction.reply('Information follows:').catch(logger.error);
        this.bot.sql.transaction(async query => {
            await buildScoreTally.call(this, guild, channel, query, champion);
        }).catch(logger.error);
    }
        
    /**
     * @param {Discord.CommandInteraction<"cached">|null} interaction 
     * @param {Discord.Guild} guild
     * @param {KCGameMapManager} kcgmm
     * @param {import('./Champion.js').default} champion
     * @param {boolean=} noRefresh
     */
    end(interaction, guild, kcgmm, champion, noRefresh) {
        const now = Date.now();

        this.bot.sql.transaction(async query => {
            if(interaction) await interaction.deferReply();
            await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}' FOR UPDATE`);

            if(interaction) await interaction.editReply(this.bot.locale.category("competition", "end_in_progress"));

            let emotes = await SQLUtil.getEmotes(this.bot.sql, guild.id) ?? {};

            /** @type {Db.competition_main|null} */
            let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}'`)).results[0];
            /** @type {Db.competition_maps[]} */
            let resultsMaps = (await query(`SELECT * FROM competition_maps WHERE guild_id = '${guild.id}'`)).results;

            if(!resultMain || resultMain.channel_id == null) {
                if(interaction) await interaction.editReply(this.bot.locale.category("competition", "no_channel"));
                return;
            }
            const channel = guild.channels.resolve(resultMain.channel_id);
            if(!channel || !(channel instanceof Discord.TextChannel)) {
                if(interaction) await interaction.editReply(this.bot.locale.category("competition", "channel_no_access"));
                return;
            }
            if(!resultMain.time_start) {
                if(interaction) await interaction.editReply(this.bot.locale.category("competition", "not_running"));
                return;
            }
            if(resultsMaps.length <= 0) {
                if(interaction) await interaction.editReply(this.bot.locale.category("competition", "cant_end_no_maps"));
                return;
            }

            if(!noRefresh) await this.loop(guild, kcgmm);

            await Bot.Util.Promise.sleep(1000);
            await channel.send(this.bot.locale.category("competition", "end_channel_ended"));

            /** @type {Discord.Collection<Db.competition_maps, KCGameMapManager.MapLeaderboard>} */
            const maps = new Discord.Collection();

            //Ensure proper order of messages.
            resultsMaps.sort((a, b) => this.games.indexOf(a.game) - this.games.indexOf(b.game));
            
            let _messages = [];
            for(let resultMaps of resultsMaps) {
                let map = getMapScoreQueryDataFromDatabase(resultMaps);

                const fullMapLeaderboard = await kcgmm.getMapScores(map, undefined, "specialevent");
                if(fullMapLeaderboard == null) {
                    if(interaction) await interaction.editReply("Failed to end competition.");
                    throw new Error("Failed to get map scores.");
                }
                const registeredMapLeaderboard = await getMapLeaderboardWithOnlyRegisteredUsers.bind(this)(query, guild, map.game, fullMapLeaderboard);
                
                maps.set(resultMaps, registeredMapLeaderboard);
                
                const mapData = map.id == null ? undefined : kcgmm.getMapById(map.game, map.id) ?? undefined;

                const embed = getEmbedTemplate();
                const field = await getEmbedFieldFromMapData.call(this, guild, registeredMapLeaderboard, map, emotes[map.game], mapData, true);
                embed.title = field.name;
                embed.description = field.value;
                embed.footer = {
                    text: Bot.Util.getFormattedDate(resultMain.time_start || 0, true) + " - " + Bot.Util.getFormattedDate(now, true),
                }
                
                _messages.push((await channel.send({content: "Previous competition standings:", embeds: [embed]})).id);
            }

            await query(`UPDATE competition_main SET previous_competition_message_ids = ? WHERE guild_id = ?`, [_messages.join(','), guild.id]);

            let insertComps = (await query(`INSERT INTO competition_history_competitions (guild_id, time_end)
                VALUES ('${guild.id}', '${now}')`)).results;

            for(let map of maps.keys()) {
                let insertMaps = (await query(`INSERT INTO competition_history_maps (id_competition_history_competitions, game, type, map_id, size, complexity, name, objective, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [insertComps.insertId, map.game, map.type, map.map_id, map.size, map.complexity, map.name, map.objective, map.timestamp])).results;

                let leaderboard = /** @type {KCGameMapManager.MapLeaderboard} */(maps.get(map));
                let entries = leaderboard.entries[map.objective == null ? 0 : map.objective];
                if(entries) {
                    for(let score of entries) {
                        let insertScores = (await query(`INSERT INTO competition_history_scores (id_competition_history_maps, user_rank, user_id, time, plays, score, eco, unitsBuilt, unitsLost)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [insertMaps.insertId, score.rank, score.user, score.time, score.plays, score.score, score.eco, score.unitsBuilt, score.unitsLost])).results;
                    }
                }
            }

            await query(`DELETE FROM competition_messages WHERE guild_id = '${guild.id}'`);
            await query(`UPDATE competition_main SET time_start = NULL, time_end = NULL, time_end_offset = NULL WHERE guild_id = '${guild.id}'`);
            await query(`DELETE FROM competition_maps WHERE guild_id = '${guild.id}'`);

            if(interaction) await interaction.editReply(this.bot.locale.category("competition", "end_success"));
            await buildScoreTally.call(this, guild, channel, query, champion);

            this.cache.set(guild.id, 'comp_maps', []);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     * @param {KCGameMapManager} kcgmm
     * @param {string} game
     * @param {import('./Map.js').default} map
     * @param {KCGameMapManager.MapScoreQueryData=} msqd
     */
    mapCmd(interaction, guild, member, channel, kcgmm, game, map, msqd) {
        this.bot.sql.transaction(async query => {
            if(!interaction.deferred) await interaction.deferReply();
            if(msqd != null) {
                if(await getMapAlreadyFeaturedInPreviousCompetition(query, guild, game, msqd)) {
                    await interaction.editReply('❌ This map was already featured in a previous competition.');
                    return;
                }
                else {
                    await interaction.editReply('✅ This map was not featured in a previous competition.');
                    return;
                }
            }

            let mapList = kcgmm.getMapListId(game);
            if(!mapList) {
                await interaction.editReply(this.bot.locale.category('competition', 'game_not_supported'));
                return;
            }

            /** @type {Db.competition_history_maps[]} */
            let resultsMaps = (await query(`SELECT * FROM competition_history_maps chm 
                JOIN competition_history_competitions chc ON chc.id = chm.id_competition_history_competitions
                WHERE chc.guild_id = '${guild.id}'
                AND chm.game = '${game}'
                AND chm.type = 'custom'`)).results;

            for(let resultMaps of resultsMaps) {
                if(resultMaps.map_id) mapList.delete(resultMaps.map_id);
            }

            let arr = [...mapList.keys()];
            let id = arr[Bot.Util.getRandomInt(0, arr.length)];

            await map.map(interaction, guild, member, channel, game, kcgmm, { id: id, allowTemporaryDelete: false });
            return;
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     * @param {'champion'|'chronom'} type
     */
    intro(interaction, guild, channel, type) {
        const embed = getEmbedTemplate();

        if(type === 'champion') {
            let roleId = this.bot.getRoleId(guild.id, 'CHAMPION_OF_KC');
            embed.color = 4482815;

            embed.description = `:fire: **Introduction to Champions**\n:trophy: Become <@&${roleId}>!\n\nRegister your name: \`/c register\`\n:warning: **__Submit scores with the \`specialevent\` group name__**\n\nReach top 5 in the score tally or place #1 at the end of a competition in any of the maps listed in the pinned messages in the pins above this one to become Champion.`;
        }
        else if(type === 'chronom') {
            let roleId = this.bot.getRoleId(guild.id, 'MASTER_OF_CHRONOM');
            embed.color = 12141774;

            embed.description = `:fire: **Introduction to Chronom**\n:trophy: Become <@&${roleId}>!\n\nRegister your name: \`/c register\`\n:warning: **__Submit scores with the \`specialevent\` group name__**\n\nComplete all of the latest Creeper World 4 Chronom maps to become Master of Chronom. Track your status with the \`/chronom\` command in <#457188713978527746>.\nYou can also get this role by reaching a high score in one or more recent Chronom maps. See standings in the message above this pin.`;
        }

        embed.image = {
            url: 'https://media.discordapp.net/attachments/376817338990985246/783860176292806697/specialevent.png'
        }

        channel.send({embeds: [embed]}).then(async message => {
            await this.bot.sql.transaction(async query => {
                if(type === 'champion') {
                    await query(`UPDATE competition_main SET champion_intro_message_id = ? WHERE guild_id = ?`, [message.id, guild.id]);
                }
                else if(type === 'chronom') {
                    await query(`UPDATE competition_main SET chronom_intro_message_id = ? WHERE guild_id = ?`, [message.id, guild.id]);
                }
            });
        }).catch(logger.error);

        interaction.reply('Message sent.').catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     * @param {Discord.Guild} guild
     */
    pinMania(interaction, channel, guild) {
        if(this.pinManiaActive) return;
        this.pinManiaActive = true;
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            /** @type {Db.competition_messages[]} */
            let compMessages = (await query(`SELECT * FROM competition_messages WHERE guild_id = ?`, [guild.id])).results;
            /** @type {Db.competition_main} */
            let main = (await query(`SELECT * FROM competition_main WHERE guild_id = ?`, [guild.id])).results[0];
            if(main == null || main.channel_id == null) {
                await interaction.editReply('Competition channel is not set.');
                return;
            }
            if(channel.id !== main.channel_id) {
                await interaction.editReply('You can only do this in the Competition channel.');
                return;
            }
            const pinned = await channel.messages.fetchPinned();
            for(const msg of pinned) {
                await msg[1].unpin();
                await Bot.Util.Promise.sleep(1000);
            }
            if(main.previous_competition_message_ids != null) {
                for(const channelId of main.previous_competition_message_ids.split(',').reverse()) {
                    let message = await channel.messages.fetch(channelId).catch(() => {});
                    if(message) {
                        await message.pin();
                        await Bot.Util.Promise.sleep(1000);
                    }
                }
            }
            if(main.previous_competition_title_message_id != null) {
                let message = await channel.messages.fetch(main.previous_competition_title_message_id).catch(() => {});
                if(message) {
                    await message.pin();
                    await Bot.Util.Promise.sleep(1000);
                }
            }
            if(main.current_champions_message_id != null) {
                let message = await channel.messages.fetch(main.current_champions_message_id).catch(() => {});
                if(message) {
                    await message.pin();
                    await Bot.Util.Promise.sleep(1000);
                }
            }
            if(main.score_tally_message_id != null) {
                let message = await channel.messages.fetch(main.score_tally_message_id).catch(() => {});
                if(message) {
                    await message.pin();
                    await Bot.Util.Promise.sleep(1000);
                }
            }
            if(main.chronom_intro_message_id != null) {
                let message = await channel.messages.fetch(main.chronom_intro_message_id).catch(() => {});
                if(message) {
                    await message.pin();
                    await Bot.Util.Promise.sleep(1000);
                }
            }
            if(main.chronom_leaders_message_id != null) {
                let message = await channel.messages.fetch(main.chronom_leaders_message_id).catch(() => {});
                if(message) {
                    await message.pin();
                    await Bot.Util.Promise.sleep(1000);
                }
            }
            if(main.champion_intro_message_id != null) {
                let message = await channel.messages.fetch(main.champion_intro_message_id).catch(() => {});
                if(message) {
                    await message.pin();
                    await Bot.Util.Promise.sleep(1000);
                }
            }
            compMessages.sort((a, b) => this.games.indexOf(b.game) - this.games.indexOf(a.game));
            for(const msg of compMessages) {
                let message = await channel.messages.fetch(msg.message_id).catch(() => {});
                if(message) {
                    await message.pin();
                    await Bot.Util.Promise.sleep(1000);
                }
            }

            this.pinManiaActive = false;

            await interaction.editReply('All done.');
        }).catch(logger.error);
    }
    
    /** 
     * @param {Discord.Guild} guild 
     * @param {KCGameMapManager} kcgmm
     * @param {(import('./Champion.js').default)=} champion
     * @returns {Promise<void>}
     */
    async loop(guild, kcgmm, champion) {
        const now = Date.now();

        let emotes = await SQLUtil.getEmotes(this.bot.sql, guild.id) ?? {};

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
                
            const overtimeRemaining = (this.timeOffsetHours * 60 * 60 * 1000) - (Date.now() - (resultMain.time_end??0));

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

                const fullMapLeaderboard = await kcgmm.getMapScores(map, undefined, "specialevent");
                if(fullMapLeaderboard == null) {
                    throw new Error("Failed to get map scores.");
                }
                const registeredMapLeaderboard = await getMapLeaderboardWithOnlyRegisteredUsers.bind(this)(query, guild, map.game, fullMapLeaderboard);

                const emote = (emotes && map.game && emotes[map.game]) ? emotes[map.game] : ":map:";
                let embed = embeds.get(map.game);
                if(!embed) {
                    embed = getEmbedScores(KCUtil.gameEmbedColors[map.game], timeLeft, overtimeRemaining);
                    embeds.set(map.game, embed);
                }

                const mapData = map.id == null ? undefined : kcgmm.getMapById(map.game, map.id) ?? undefined;
                const field = await getEmbedFieldFromMapData.call(this, guild, registeredMapLeaderboard, map, emote, mapData, false);

                if(hasMapStatusChanged.call(this, guild, map, registeredMapLeaderboard)) {
                    const embed = getEmbedScores(KCUtil.gameEmbedColors[map.game]);
                    embed.title = ":trophy: First place score update!";
                    embed.fields = [];

                    const field = await getEmbedFieldFromMapData.call(this, guild, registeredMapLeaderboard, map, emote, mapData, false, true);
                    embed.fields[0] = field;
                    channel.send({ embeds: [embed] }).catch(logger.error);
                }

                let fields = embed.fields;
                if(!fields) fields = [];
                fields.push(field);

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
                    message.edit({content: content, embeds: [getEmbedScores(KCUtil.gameEmbedColors[game], timeLeft, overtimeRemaining)]}).catch(logger.error);
                else
                    message.edit({content: content, embeds: [embed]}).catch(logger.error);
            });
        }).catch(logger.error);

        await this.bot.sql.transaction(async query => {
            /** @type {Db.competition_main|null} */
            let resultMain = (await query(`SELECT * FROM competition_main WHERE guild_id = '${guild.id}'`)).results[0];
            if(resultMain == null) return;
            if(resultMain.time_end == null) return;
            if(resultMain.time_end_offset == null) return;

            let timeEnd = resultMain.time_end + resultMain.time_end_offset;
            
            if(now >= timeEnd) return true;
        }).then(shouldEnd => {
            if(shouldEnd && champion) this.end(null, guild, kcgmm, champion, true);
        }).catch(logger.error);
    }
}




/**
 * @this Competition
 * @param {Discord.Guild} guild 
 * @param {Discord.PartialDMChannel | Discord.TextChannel | Discord.ThreadChannel} channel
 * @param {SQLWrapper.Query} query
 * @param {import('./Champion.js').default} champion
 */
async function buildScoreTally(guild, channel, query, champion) {
    /** @type {Discord.Collection<Discord.Snowflake, boolean>} */
    const champions = new Discord.Collection();
    /** @type {Discord.Collection<Discord.Snowflake, { points: number, champion: boolean, weeks: number }>} */
    const players = new Discord.Collection();
    /** @type {Discord.Collection<Discord.Snowflake, Promise<void | Discord.GuildMember>>} */
    const guildMembersPromise = new Discord.Collection();
    /** @type {Discord.Collection<Discord.Snowflake, Discord.GuildMember>} */
    const guildMembers = new Discord.Collection();

    const weeks = 2;
    const tallyChamps = 5;
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
                let player = players.get(resultScores.user_id);
                const points = ((player?.points)??0) + getPointsFromRank(resultScores.user_rank);
                guildMembersPromise.set(resultScores.user_id, guild.members.fetch(resultScores.user_id).catch(() => {}));

                if(resultScores.user_rank === 1) {
                    players.set(resultScores.user_id, { points: points, champion: true, weeks: Math.max(i, player?.weeks??0) });
                    champions.set(resultScores.user_id, true);
                }
                else {
                    players.set(resultScores.user_id, { points: points, champion: false, weeks: Math.max(0, player?.weeks??0) });
                }
            }
        }
        i++;
    }

    for(let keyval of guildMembersPromise) {
        const member = await keyval[1];
        if(member instanceof Discord.GuildMember)
            guildMembers.set(keyval[0], member);
    }

    players.sort((a, b) => b.points - a.points);

    (() => {
        let i = 0;
        let lastPoints = 0;
        players.each((value, key) => {
            //if we're looking at the 6th player and they have the same score as the 5th player, bump them back down to being a 5th player
            if(i === tallyChamps && value.points === lastPoints)
                i--;

            //if this player is within the first five ranks
            if(i < tallyChamps) {
                value.champion = true;
                champions.set(key, true);
            }

            lastPoints = value.points;
            i++;
        });
    })();

    await champion.refreshCompetitionChampions(query, guild, champions);

    (async () => {
        const embed = new Discord.MessageEmbed({ color: 1482885 });
        const field = {
            name: `Score tally from last ${weeks} competitions`,
            value: "",
            inline: false
        }
        let i = 1;
        let lastPoints = 0;
        let maxShown = 10;
        for(let user of players) {
            let points = user[1].points;
            let snowflake = user[0];

            if(i - 1 === tallyChamps && points === lastPoints)
                i--;

            let bold = i <= tallyChamps ? '**' : '';
            
            const championMember = guildMembers.get(snowflake);
            const name = championMember ? (championMember.nickname ?? championMember.user.username) : null;
            if(name) {
                if(i > maxShown) {
                    field.value += `...and ${players.size - i + 1} more players.\n`;
                    break;
                }
                else {
                    field.value += `${bold}\`#${i}\` ${points} points: ${name}${bold}\n`;
                }
            }
            lastPoints = points;
            i++;
        }
        if(field.value.length === 0) field.value = "None";
        embed.fields = [];
        embed.fields.push(field);

        await query(`UPDATE competition_main SET score_tally_message_id = ? WHERE guild_id = ?`, [(await channel.send({embeds: [embed]})).id, guild.id]);
    })().then(async () => {
        const embed = new Discord.MessageEmbed({ color: 1482885 });
        const field = {
            name: "Current champions",
            value: "",
            inline: false
        }
        for(let player of players) {
            const snowflake = player[0];
            const data = player[1];
            
            if(!data.champion) continue;

            const championMember = guildMembers.get(snowflake);
            const name = championMember ? (championMember.nickname ?? championMember.user.username) : null;
            if(name) field.value += `\`${data.points} points${Bot.Util.String.fixedWidth('', data.weeks, '*')}\` ${name}\n`;
        }

        if(field.value.length === 0) field.value = "None";
        else {
            field.value += `\nEach * is the number of competitions this player is guaranteed to remain Champion for getting 1st place\n`;
        }
        
        embed.fields = [];
        embed.fields.push(field);
        
        await query(`UPDATE competition_main SET current_champions_message_id = ? WHERE guild_id = ?`, [(await channel.send({embeds: [embed]})).id, guild.id]);
    }).catch(logger.error);
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
 * @param {number=} timeRemaining - in milliseconds.
 * @param {number=} overtimeRemaining - in milliseconds
 * @returns {Discord.MessageEmbed}
 */
function getEmbedScores(color, timeRemaining, overtimeRemaining) {
    const embed = new Discord.MessageEmbed({
        color: color,
        description: "",
        timestamp: new Date(),
    });
    if(timeRemaining != null) {
        embed.footer = {
            text: timeRemaining > 0 ? `Time left: ${Bot.Util.getFormattedTimeRemaining(timeRemaining)}` : `OVERTIME (randomly between 0 and ${Bot.Util.getFormattedTimeRemaining(overtimeRemaining??0)} left)`
        }
    }
    return embed;
}

/**
 * @this {Competition}
 * @param {Discord.Guild} guild
 * @param {KCGameMapManager.MapLeaderboard} mapLeaderboard
 * @param {KCGameMapManager.MapScoreQueryData} mapScoreQueryData 
 * @param {string} emoteStr
 * @param {KCGameMapManager.MapData=} mapData
 * @param {boolean=} isPoints
 * @param {boolean=} onlyFirstPlace
 * @returns {Promise<{name: string, value: string, inline: boolean}>}
 */
async function getEmbedFieldFromMapData(guild, mapLeaderboard, mapScoreQueryData, emoteStr, mapData, isPoints, onlyFirstPlace) {
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
            if(this.dmd != null && mapScoreQueryData.id != null) {
                let dmdMap = await this.dmd.getDMDMapInfo(mapScoreQueryData.id);
                if(dmdMap != null) {
                    value = `${dmdMap.name} __by ${dmdMap.owner}__\n`;
                }
            }
            break;
        case "markv":
            value = "Seed: `" + mapScoreQueryData.name + "`\n";
            value += `Objective: **${KCLocaleManager.getDisplayNameFromAlias('cw4_objectives', mapScoreQueryData.objective+'')}**`;
            break;
        case 'chronom': {
            let date = new Date(mapScoreQueryData.timestamp??0);
            value = `Date: ${chronom_months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}\n`;
            value += `Objective: **${KCLocaleManager.getDisplayNameFromAlias('cw4_objectives', mapScoreQueryData.objective+'')}**`;
            break;
        }
        default:
            if(!mapData) {
                name = ":warning: Uh oh";
                value = "Information about this map is taking a while to load. Use `/c update` to force a reload. For CW2, you may need to wait up to 20 minutes first.";
                break;
            }
            name += `: #${mapData.id}`;
            value = `${mapData.title} __by ${mapData.author}__\n`;
            if(mapData.game === 'cw4')
                value += `Objective: **${KCLocaleManager.getDisplayNameFromAlias('cw4_objectives', mapScoreQueryData.objective+'')}**`;
            else
                value += `${getDifficultyStringFromMapData(mapData)}`;
            if(mapData.width != null && mapData.height != null)
                value += `, ${mapData.width}x${mapData.height}`;
            break;
    }

    
    const entries = mapScoreQueryData.objective == null ? mapLeaderboard.entries[0] : mapLeaderboard.entries[mapScoreQueryData.objective];
    let leaderboardStr = '';
    let maxScoresInTable = onlyFirstPlace ? Math.min(this.maxScoresInTable, 2) : this.maxScoresInTable;
    if(entries != null && entries.length > 0) {
        for(let i = 0; i < entries.length; i++) {
            let entry = entries[i];

            /** @type {void|Discord.GuildMember} */
            const member = await guild.members.fetch(entry.user).catch(() => {});
            const name = (member ? member.nickname || member.user.username : entry.user).substring(0, 17);

            if(i <= maxScoresInTable - 1) {
                if(isPoints) 
                    leaderboardStr += `${Bot.Util.String.fixedWidth(getPointsFromRank(entry.rank) + " pts", 7, "⠀", true)}`;
                else
                    leaderboardStr += `#${Bot.Util.String.fixedWidth(entry.rank+"", 2, "⠀", true)}`;
                
                leaderboardStr += `${Bot.Util.String.fixedWidth(entry.time != null ? KCUtil.getFormattedTimeFromFrames(entry.time) : (entry.score+'')??'', 8, "⠀", false)} ${name}\n`;
            }
            else if(i === maxScoresInTable) {
                if(!onlyFirstPlace) leaderboardStr += `${(entries.length - i)} more scores from: `;
                else                leaderboardStr += `and ${(entries.length - i)} more scores.`;
            }

            if(i >= maxScoresInTable && !onlyFirstPlace) {
                leaderboardStr += `${name}${i < entries.length - 1 ? ', ' : ''}`;
            }
        }
    }
    else {
        leaderboardStr += "No scores yet!";
    }

    leaderboardStr = leaderboardStr.substring(0, KCUtil.embedLimits.fieldValue - value.length - 40);
    value = `${value}\`\`\`${leaderboardStr}\`\`\``;

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
    if(mapData.scores && mapData.downloads) {
        let ratio = mapData.scores / mapData.downloads;
        let percentage = Math.floor(ratio * 100) + "%";
        let str = `${percentage} clears`;
        return str;
    }

    return 'difficulty indeterminable';
}

/**
 * 
 * @param {KCGameMapManager.MapData} mapData 
 * @returns {string}
 */
function getDifficultyEmoteFromMapData(mapData) {
    if(mapData.scores == null || mapData.downloads == null)
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
 * Parse a leaderboard on the KC server into a leaderboard on Discord
 * @this Competition
 * @param {SQLWrapper.Query} query
 * @param {Discord.Guild} guild
 * @param {string} game
 * @param {KCGameMapManager.MapLeaderboard} mapLeaderboard 
 * @returns {Promise<KCGameMapManager.MapLeaderboard>} New leaderboard without users that haven't registered on Discord.
 */
async function getMapLeaderboardWithOnlyRegisteredUsers(query, guild, game, mapLeaderboard) {
    /** @type {KCGameMapManager.MapLeaderboardEntry[][]} */
    const newEntries = [];

    for(let i = 0; i < mapLeaderboard.entries.length; i++) {
        let oldEntries = mapLeaderboard.entries[i];
        if(oldEntries == null) continue;
        newEntries[i] = [];

        /** @type {Object.<string, boolean>} */
        const names = {};

        let rank = 0;
        /** @type {null|number} */
        let lastTime = null;

        for(let entry of oldEntries) {
            /** @type {Db.competition_register} */
            let resultRegister = (await query(`SELECT * FROM competition_register 
            WHERE guild_id = ? AND user_name = ? AND game = ?`, [guild.id, entry.user, game])).results[0];
            if(resultRegister == null) continue;

            if(names[resultRegister.user_name] != null) continue;
            names[resultRegister.user_name] = true;

            /** @type {void|Discord.GuildMember} */
            let member = await guild.members.fetch(resultRegister.user_id).catch(() => {});

            if(member == null) continue;

            let newEntry = { ...entry };
            newEntry.user = member.id;

            let scoretime = newEntry.time??newEntry.score;

            if(scoretime != null) {
                //Handle ties
                if(lastTime == null || scoretime !== lastTime) {
                    rank++;
                }
                lastTime = scoretime;
            }

            newEntry.rank = rank;

            newEntries[i].push(newEntry);
        }
    }

    return {
        entries: newEntries
    }
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
        name: resultMaps.name ?? undefined,
        objective: resultMaps.objective ?? undefined,
        timestamp: resultMaps.timestamp ?? undefined, 
    }
}

/**
 * @this {Competition}
 * @param {Discord.Guild} guild
 * @param {KCGameMapManager.MapScoreQueryData} msqd
 * @param {KCGameMapManager.MapLeaderboard} leaderboard
 * @returns {boolean}
 */
function hasMapStatusChanged(guild, msqd, leaderboard) {
    /** @type {{msqd: KCGameMapManager.MapScoreQueryData, leaderboard: KCGameMapManager.MapLeaderboard}[]} */
    let compMaps = this.cache.get(guild.id, 'comp_maps');

    let compMapMatch = compMaps.find(v => KCUtil.objectCompareShallow(v.msqd, msqd));

    if(compMapMatch == null) {
        compMaps.push({ msqd, leaderboard });
        this.cache.set(guild.id, 'comp_maps', compMaps);
        return false;
    }
    else {
        compMaps[compMaps.indexOf(compMapMatch)] = { msqd, leaderboard }
        this.cache.set(guild.id, 'comp_maps', compMaps);

        const leaderboardIndex = msqd.objective ?? 0;
        let leaderboardOld = compMapMatch.leaderboard.entries[leaderboardIndex];
        let leaderboardNew = leaderboard.entries[leaderboardIndex];
        if(leaderboardOld == null || leaderboardNew == null) return false;

        leaderboardOld = leaderboardOld.slice().filter(v => v.rank === 1);
        leaderboardNew = leaderboardNew.slice().filter(v => v.rank === 1);
        if(leaderboardOld.length !== leaderboardNew.length) return true;
        leaderboardOld.sort();
        leaderboardNew.sort();

        //leaderboard lengths are assumed to be equal by this point
        let len = leaderboardOld.length;
        //let len = Math.min(this.maxScoresInTable, Math.min(leaderboardNew.length, leaderboardOld.length));
        for(let i = 0; i < len; i++) {
            if(leaderboardOld[i].user !== leaderboardNew[i].user || leaderboardOld[i].time !== leaderboardNew[i].time || leaderboardOld[i].score !== leaderboardNew[i].score)
                return true;
        }
    }
    return false;
}

/**
 * @this {Competition}
 * @param {SQLWrapper.Query} query
 * @param {Discord.Guild} guild
 * @param {string} game
 * @param {KCGameMapManager.MapScoreQueryData} msqd
 * @returns {Promise<boolean>}
 */
async function getMapAlreadyFeaturedInPreviousCompetition(query, guild, game, msqd) {
    /** @type {Db.competition_history_maps[]} */
    var resultsHistoryMaps = (await query(`SELECT * FROM competition_history_maps chm JOIN competition_history_competitions chc ON chc.id = chm.id_competition_history_competitions
        WHERE chc.guild_id = ${mysql.escape(guild.id)}
        AND chm.game = ${mysql.escape(game)}
        AND chm.type = ${mysql.escape(msqd.type)}
        AND chm.map_id ${msqd.id == null ? 'IS NULL' : `= ${mysql.escape(msqd.id)}`}
        AND chm.size ${msqd.size == null ? 'IS NULL' : `= ${mysql.escape(msqd.size)}`}
        AND chm.complexity ${msqd.complexity == null ? 'IS NULL' : `= ${mysql.escape(msqd.complexity)}`}
        AND chm.name ${msqd.name == null ? 'IS NULL' : `= ${mysql.escape(msqd.name)}`}
        AND chm.objective ${msqd.objective == null ? 'IS NULL' : `= ${mysql.escape(msqd.objective)}`}
        AND chm.timestamp ${msqd.timestamp == null ? 'IS NULL' : `= ${mysql.escape(msqd.timestamp)}`}`)).results;
    if(resultsHistoryMaps.length > 0) return true;
    return false;
}