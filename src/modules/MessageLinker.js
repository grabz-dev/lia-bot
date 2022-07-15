'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;


export default class MessageLinker extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /** @param {Discord.Message} message - The message that was sent. */
    onMessage(message) {
        if(message.guild == null) return;
        if(!message.content.includes('discord.com/channels/')) return;
        var str = message.content.substring(message.content.indexOf('discord.com/channels/') + 21)
        if(str.indexOf(' ') > -1) str = str.substring(0, str.indexOf(' '));
        if(str.indexOf('\n') > -1) str = str.substring(0, str.indexOf('\n'));
        let split = str.split('/');
        if(split.length !== 3) return;
        const guildId = split[0];
        if(message.guild.id !== guildId) return;
        const channelId = split[1];
        const messageId = split[2];
        message.guild.channels.fetch(channelId).then(channel => {
            if(channel == null) return;
            /** @type {Discord.TextChannel} */(channel)?.messages?.fetch(messageId).then(m => {
                if(!m.member || !m.guild) return;
                let embed = getEmbed(m, m.member, m.guild, `https://discord.com/channels/${split[0]}/${split[1]}/${split[2]}`);
                message.reply({ embeds: [embed] }).catch(logger.error);
            }).catch(logger.error)
        }).catch(logger.error);
    }
}

/**
 * 
 * @param {Discord.Message} message 
 * @param {Discord.GuildMember} member
 * @param {Discord.Guild} guild
 * @param {string} url
 * @returns {Discord.MessageEmbed}
 */
function getEmbed(message, member, guild, url) {
    let embed = new Discord.MessageEmbed({
        
    });

    embed.author = {
        name: `${(member.nickname??member.user.username)}#${member.user.discriminator} said:`,
        iconURL: member.user.avatarURL() || member.user.defaultAvatarURL
    }
    embed.description = message.content;
    embed.fields = [{
        name: 'Source',
        value: `[Jump to message](${url}) in <#${message.channel.id}>`,
        inline: false
    }];
    embed.footer = {
        text: `Message posted on ${Bot.Util.getFormattedDate(message.createdTimestamp, true)}`
    }

    return embed;
}