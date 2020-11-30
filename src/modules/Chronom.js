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

export default class Chronom extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        this.days = 8;
        this.daysRole = 5;
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
     * @param {'chronom'} ext.action - Custom parameters provided to function call.
     * @param {KCGameMapManager} ext.kcgmm
     * @param {import('./Map.js').default} ext.map
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'chronom':
            chronom.call(this, m, ext.kcgmm);
            return;
        }
    }

    /** 
     * @param {Discord.Guild} guild 
     * @param {KCGameMapManager} kcgmm
     * @returns {Promise<void>}
     */
    async loop(guild, kcgmm) {
        const now = Date.now();

        this.bot.sql.transaction(async query => {
            const roleId = this.bot.getRoleId(guild.id, 'MASTER_OF_CHRONOM');
            if(roleId == null) return;

            /** @type {any[]} */
            let resultsRegister = (await query(`SELECT * FROM competition_register 
        WHERE guild_id = '${guild.id}' AND game = 'cw4'`)).results;
            if(resultsRegister.length <= 0) return;

            /** @type {({timestamp: number, leaderboard: Promise<KCGameMapManager.MapLeaderboard>})[]} */
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
                    leaderboard: kcgmm.getMapScores(msqd, undefined, 'specialevent')
                }
            }

            /** @type {({timestamp: number, leaderboard: KCGameMapManager.MapLeaderboard})[]} */
            let arr2 = [];
            for(let i = 0; i < this.days; i++) {
                arr2[i] = {
                    timestamp: arr[i].timestamp,
                    leaderboard: await arr[i].leaderboard
                }
            }

            /** @type {Object.<string, boolean>} */
            let users = {};
            for(let resultRegister of resultsRegister) {
                users[resultRegister.user_name] = true;
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

            /** @type {Object.<string, {streak: number, bestStreak: number}>} */
            let streaks = {};
            for(let user of Object.keys(users)) {
                if(streaks[user] == null) streaks[user] = { streak: 0, bestStreak: 0 };
                for(let i = 0; i < this.days; i++) {
                    let completed = Object.keys(usersCompleted[i]).includes(user);
                    if(completed) streaks[user].streak++;
                    else streaks[user].streak = 0;
                    if(streaks[user].streak > streaks[user].bestStreak) streaks[user].bestStreak = streaks[user].streak;
                }
            }

            for(let user of Object.keys(streaks)) {
                let resultRegister = resultsRegister.find(v => v.user_name === user);
                if(resultRegister == null) continue;
                let member = await guild.members.fetch(resultRegister.user_id).catch(() => {});
                if(member == null) continue;

                let streak = streaks[user];
                if(streak.bestStreak >= this.daysRole) {
                    member.roles.add(roleId).catch(logger.error);
                }
                else {
                    member.roles.remove(roleId).catch(logger.error);
                }
            }
        }).catch(logger.error);
    }
}

/**
 * Post chronom info, update chronom role
 * @this {Chronom}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {KCGameMapManager} kcgmm
 */
function chronom(m, kcgmm) {
    const embed = getEmbedChronom(m.member);
    const now = Date.now();

    this.bot.sql.transaction(async query => {
        let resultRegister = (await query(`SELECT * FROM competition_register 
        WHERE guild_id = '${m.guild.id}' AND user_id = '${m.member.id}' AND game = 'cw4'`)).results[0];
        if(resultRegister == null) {
            m.message.reply(this.bot.locale.category('competition', 'chronom_not_registered', KCLocaleManager.getDisplayNameFromAlias('game', 'cw4'))).catch(logger.error);
            return;
        }

        let str = `**${KCLocaleManager.getDisplayNameFromAlias('game', 'cw4')} ${KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', 'cw4_chronom')}**\nWelcome back, ${resultRegister.user_name}\n\nMap completions:\n`;

        /** @type {({timestamp: number, completed: Promise<boolean>})[]} */
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
                completed: kcgmm.getMapCompleted(msqd, resultRegister.user_name, 'specialevent')
            }
        }

        let streak = 0;
        let bestStreak = 0;

        for(let i = 0; i < this.days; i++) {
            let data = arr[i];
            let completed = await data.completed;
            if(completed) streak++;
            else streak = 0;
            if(streak > bestStreak) bestStreak = streak;

            let date = new Date(data.timestamp);
            let year = date.getFullYear();
            let month = KCUtil.getMonthFromDate(date, true);
            let day = KCUtil.getDayFromDate(date);

            str += `${completed ? ':white_check_mark:' : ':x:'} ${month} ${day}, ${year}\n`;
        }
        str += `\nCurrent streak: ${bestStreak}/${this.days}\n`;

        let roleId = this.bot.getRoleId(m.guild.id, 'MASTER_OF_CHRONOM');
        if(roleId != null) {
            if(bestStreak >= this.daysRole) {
                str += `You are the <@&${roleId}>`;
                m.member.roles.add(roleId).catch(logger.error);
            }
            else {
                str += `Reach a streak of 5 to become <@&${roleId}>`;
                m.member.roles.remove(roleId).catch(logger.error);
            }
        }

        str += `\n\nSubmit scores with \`${resultRegister.user_name}\` as your name and \`specialevent\` as the group name.\n\`!c register help\` to change your name.`;
        embed.description = str;
        m.channel.send({embed: embed}).catch(logger.error);
    }).catch(logger.error);
}




/**
 * 
 * @param {Discord.GuildMember} member 
 * @returns {Discord.MessageEmbed}
 */
function getEmbedChronom(member) {
    let embed = new Discord.MessageEmbed({
        color: KCUtil.gameEmbedColors['cw4'],
    });

    embed.author = {
        name: member.user.username + '#' + member.user.discriminator,
        iconURL: member.user.avatarURL() || member.user.defaultAvatarURL
    }
    return embed;
}