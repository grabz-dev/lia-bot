'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import("../kc/KCGameMapManager").MapData} KCGameMapManager.MapData} */
/** @typedef {import("../kc/KCGameMapManager").MapScoreQueryData} KCGameMapManager.MapScoreQueryData} */
/** @typedef {import("../kc/KCGameMapManager").MapLeaderboard} KCGameMapManager.MapLeaderboard} */
/** @typedef {import("../kc/KCGameMapManager").MapLeaderboardEntry} KCGameMapManager.MapLeaderboardEntry} */
/** @typedef {import('./Competition.js').Db.competition_register} Db.competition_register */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';
import { SQLUtil } from '../kc/SQLUtil.js';

export default class Chronom extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);
        this.commands = ['chronom'];

        this.days = 8;
        this.daysRole = 5;
        //for reaching a high place
        this.additionalMastersCount = 5;

        /** @type {KCGameMapManager|null} */
        this.kcgmm = null;
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
        const commandName = interaction.commandName;
        switch(commandName) {
        case 'chronom': {
            return true;
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
        if(this.kcgmm == null) {
            logger.error("Not initialized.");
            return;
        };

        const commandName = interaction.commandName;
        switch(commandName) {
        case 'chronom': {
            return this.chronom(interaction, guild, member, this.kcgmm);
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
            .setName('chronom')
                .setDescription('Display your Creeper World 4 Chronom standings. This can earn you the Master of Chronom role!')
                .toJSON(),
        ]
    }

    /** 
     * @param {Discord.Guild} guild 
     * @param {KCGameMapManager} kcgmm
     * @param {{interaction: Discord.CommandInteraction<"cached">, member: Discord.GuildMember, guild: Discord.Guild}=} m 
     * @returns {Promise<void>}
     */
    async loop(guild, kcgmm, m) {
        const now = Date.now();

        this.bot.sql.transaction(async query => {
            if(m?.interaction) await m.interaction.deferReply();

            const roleId = this.bot.getRoleId(guild.id, 'MASTER_OF_CHRONOM');

            /** @type {Db.competition_register[]} */
            let resultsRegister = (await query(`SELECT * FROM competition_register 
        WHERE guild_id = '${guild.id}' AND game = 'cw4'`)).results;
            if(resultsRegister.length <= 0 && m == null) {
                return;
            };

            /** @type {({timestamp: number, leaderboard: Promise<KCGameMapManager.MapLeaderboard|null>, leaderboardScores: Promise<KCGameMapManager.MapLeaderboard|null>})[]} */
            let arr = [];
            for(let i = 0; i < this.days; i++) {
                let timestamp = now - (1000 * 60 * 60 * 24 * i);
                let msqd = {
                    game: 'cw4',
                    type: 'chronom',
                    timestamp: timestamp
                }
                
                arr[i] = {
                    timestamp: timestamp,
                    leaderboard: kcgmm.getMapScores(msqd, undefined, 'specialevent', { removeMverseTag: true }),
                    leaderboardScores: kcgmm.getMapScores(msqd, undefined, undefined, { removeMverseTag: false }),
                }
            }

            /** @type {({timestamp: number, leaderboard: KCGameMapManager.MapLeaderboard, leaderboardScores: KCGameMapManager.MapLeaderboard})[]} */
            let arr2 = [];
            for(let i = 0; i < this.days; i++) {
                const leaderboard = await arr[i].leaderboard;
                const leaderboardScores = await arr[i].leaderboardScores;

                if(leaderboard == null || leaderboardScores == null) {
                    if(m?.interaction) await m.interaction.editReply('Failed to get map scores.');
                    throw new Error("Failed to get map scores.");
                }

                arr2[i] = {
                    timestamp: arr[i].timestamp,
                    leaderboard,
                    leaderboardScores
                }
            }

            /** @type {Object.<string, Db.competition_register>} */
            let users = {};
            for(let resultRegister of resultsRegister) {
                users[resultRegister.user_name] = resultRegister;
            }

            /** @type {Array<Object<string, boolean>>} */
            let usersCompleted = [];
            for(let i = 0; i < this.days; i++) {
                usersCompleted[i] = {};
                const data = arr2[i];
                for(let entries of data.leaderboard.entries) {
                    if(entries == null) continue;
                    for(let entry of entries) {
                        usersCompleted[i][entry.user] = true;
                    }
                }
            }
            
            /** @type {{[user: string]: {timestamp: number, rank: number, objective: number, time: number, register: Db.competition_register}}} */
            const additionalMasters = {};
            let k = 0;
            loop:
            for(let i = 1; i < 100; i++) {
                for(const map of arr2) {
                    for(let j = 0; j < map.leaderboardScores.entries.length; j++) {
                        const leaderboards = map.leaderboardScores.entries[j];
                        if(leaderboards == null) continue;
                        let l = leaderboards.find(v => v.rank === i);
                        if(l == null) continue;
                        const register = users[l.user];
                        if(!register) continue;
                        const leaderboard = l;
                        if(additionalMasters[leaderboard.user] != null) continue;
                        const time = leaderboard.time??0;
                        additionalMasters[leaderboard.user] = {timestamp: map.timestamp, rank: i, objective: j, time: time, register: register};
                        k++;
                        if(k >= this.additionalMastersCount) break loop;
                    }
                }
            }

            /** @type {Object.<string, {streak: number, bestStreak: number, daysDone: boolean[]}>} */
            let streaks = {};
            for(let user of Object.keys(users)) {
                if(streaks[user] == null) streaks[user] = { streak: 0, bestStreak: 0, daysDone: [] };
                for(let i = 0; i < this.days; i++) {
                    let completed = Object.keys(usersCompleted[i]).includes(user);
                    streaks[user].daysDone[i] = completed;
                    if(completed) streaks[user].streak++;
                    else streaks[user].streak = 0;
                    if(streaks[user].streak > streaks[user].bestStreak) streaks[user].bestStreak = streaks[user].streak;
                }
            }

            /** @type {{[user: string]: {register: Db.competition_register, bestStreak: number}}} */
            const masters = {};

            for(let user of Object.keys(streaks)) {
                let resultRegister = resultsRegister.find(v => v.user_name === user);
                if(resultRegister == null) continue;
                let member = guild.members.cache.get(resultRegister.user_id);
                if(member == null) continue;

                let streak = streaks[user];
                if(roleId != null) {
                    if(streak.bestStreak >= this.daysRole) {
                        masters[user] = { bestStreak: streak.bestStreak, register: users[user] }
                    }

                    if(streak.bestStreak >= this.daysRole || additionalMasters[user] != null) {
                        if(!member.roles.cache.has(roleId))
                            member.roles.add(roleId).catch(logger.error);
                    }
                    else {
                        if(member.roles.cache.has(roleId))
                            member.roles.remove(roleId).catch(logger.error);
                    }
                }
            }

            await (async () => {
                let emote = await SQLUtil.getEmote(this.bot.sql, guild.id, 'cw4') ?? ':game_die:';

                /** @type {import ('./Competition.js').Db.competition_main} */
                const c = (await query(`SELECT * FROM competition_main WHERE guild_id = ?`, [guild.id])).results[0];
                if(c == null || c.channel_id == null) return;
                const channel = await guild.client.guilds.cache.get(guild.id)?.channels.fetch(c.channel_id).catch(() => {});
                if(channel == null || !(channel instanceof Discord.TextChannel)) return;
                let messageUpdated = false;
                if(c.chronom_leaders_message_id != null) {
                    const message = await channel.messages.fetch(c.chronom_leaders_message_id).catch(() => {});
                    if(message != null) {
                        getAdditionalMastersEmbed.call(this, additionalMasters, masters, message, emote);
                        messageUpdated = true;
                    }
                }
                if(!messageUpdated) {
                    const message = await channel.send({embeds: [{description: '...'}]});
                    getAdditionalMastersEmbed.call(this, additionalMasters, masters, message, emote);
                    await query(`UPDATE competition_main SET chronom_leaders_message_id = ? WHERE guild_id = ?`, [message.id, guild.id]);
                }
            })().catch(logger.error);





            
            if(m == null) return;

            //'!c chronom' code follows

            const embed = getEmbedChronom(m.member);

            let resultRegister = (await query(`SELECT * FROM competition_register 
            WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}' AND game = 'cw4'`)).results[0];
            if(resultRegister == null) {
                await m.interaction.editReply(this.bot.locale.category('competition', 'chronom_not_registered', KCLocaleManager.getDisplayNameFromAlias('game', 'cw4')));
                return;
            }

            let str = `**${KCLocaleManager.getDisplayNameFromAlias('game', 'cw4')} ${KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', 'cw4_chronom')}**\nWelcome back, ${resultRegister.user_name}\n\nMap completions:\n`;

            let streak = streaks[resultRegister.user_name];

            for(let i = 0; i < this.days; i++) {
                let completed = streak.daysDone[i];

                if(i < 5)
                    str += `${completed ? ':white_check_mark:' : ':x:'} ${getDateString(arr[i].timestamp)}\n`;
            }
            str += `\nCurrent streak: ${streak.bestStreak}/${this.days}\n`;

            if(roleId != null) {
                if(streak.bestStreak >= this.daysRole) {
                    str += `You are the <@&${roleId}>`;
                }
                else {
                    str += `Reach a streak of 5 to become <@&${roleId}>`;
                }
            }

            str += `\n\nSubmit scores with \`${resultRegister.user_name}\` as your name and \`specialevent\` as the group name.\n\`/c register\` to change your name.`;
            embed.description = str;
            await m.interaction.editReply({embeds: [embed]});
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {KCGameMapManager} kcgmm
     */
    chronom(interaction, guild, member, kcgmm) {
        this.loop(guild, kcgmm, { guild, interaction, member });
    }
}


/**
 * 
 * @param {Discord.GuildMember} member 
 * @returns {Discord.APIEmbed}
 */
function getEmbedChronom(member) {
    /** @type {Discord.APIEmbed} */
    let embed = {
        color: KCUtil.gameEmbedColors['cw4'],
    }

    embed.author = {
        name: KCUtil.getUserDisplayName(member, member.user),
        icon_url: member.user.avatarURL() || member.user.defaultAvatarURL
    }
    return embed;
}

/**
 * @this {Chronom}
 * @param {{[user: string]: {timestamp: number, rank: number, objective: number, time: number, register: Db.competition_register}}} additionalMasters
 * @param {{[user: string]: {register: Db.competition_register, bestStreak: number}}} masters
 * @param {string} emote
 * @param {Discord.Message} message
 */
function getAdditionalMastersEmbed(additionalMasters, masters, message, emote) {
    /** @type {Discord.APIEmbed} */
    let embed = {
        color: KCUtil.gameEmbedColors['cw4'],
    }
    
    embed.title = `${emote} Masters of Chronom`;

    embed.description = `Remember to submit scores with the \`specialevent\` group name!\n\nThe following users are currently Masters of Chronom for getting a high score on recent Chronom maps. This list always populates ${this.additionalMastersCount} entries.\n`;
    for(const key of Object.keys(additionalMasters)) {
        const master = additionalMasters[key];
        let member = message.guild?.members.cache.get(master.register.user_id);
        let name = member ? (KCUtil.getUserDisplayName(member, member.user)) : master.register.user_name;

        embed.description += `**${name}** is **#${master.rank}** in ${KCLocaleManager.getDisplayNameFromAlias("cw4_objectives", master.objective+'')}\n > on ${getDateString(master.timestamp)} with ${KCUtil.getFormattedTimeFromFrames(master.time)}\n`;
    }

    embed.description += `\nIn addition, the following users are also Masters of Chronom for keeping a streak of ${this.daysRole} Chronom completions.\n`;

    for(const key of Object.keys(masters)) {
        const master = masters[key];
        let member = message.guild?.members.cache.get(master.register.user_id);
        let name = member ? (KCUtil.getUserDisplayName(member, member.user)) : master.register.user_name;
        embed.description += `**${name}** with a streak of **${master.bestStreak}**\n`;
    }

    message.edit({embeds: [embed]}).catch(logger.error);
}

/**
 * 
 * @param {number} timestamp 
 */
function getDateString(timestamp) {
    let date = new Date(timestamp);
    let year = date.getFullYear();
    let month = KCUtil.getMonthFromDate(date, true);
    let day = KCUtil.getDayFromDate(date);

    return `${month} ${day}, ${year}`;
}