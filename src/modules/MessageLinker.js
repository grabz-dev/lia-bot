'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
import { KCUtil } from '../kc/KCUtil.js';
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
                let embed = getEmbed(m, m.member, m.author, `https://discord.com/channels/${split[0]}/${split[1]}/${split[2]}`);
                message.reply({ embeds: [embed] }).catch(logger.error);
            }).catch(logger.error)
        }).catch(logger.error);
    }
}

/**
 * 
 * @param {Discord.Message} message 
 * @param {Discord.GuildMember|null} member
 * @param {Discord.User} user
 * @param {string} url
 * @returns {Discord.APIEmbed}
 */
function getEmbed(message, member, user, url) {
    /** @type {Discord.APIEmbed} */
    let embed = {
        
    };

    embed.author = {
        name: `${(KCUtil.getUserDisplayName(member, user))} said:`,
        icon_url: user.avatarURL() || user.defaultAvatarURL
    }
    embed.description = message.content;
    embed.fields = [{
        name: 'Source',
        value: `[Jump to message](${url}) posted on <t:${Math.trunc(message.createdTimestamp/1000)}:f> in <#${message.channel.id}>`,
        inline: false
    }];

    let imageAttachment = '';
    for(const att of message.attachments.values()) {
        if(att.contentType?.includes('image')) {
            imageAttachment = att.proxyURL;
            break;
        }
    }

    if(imageAttachment.length > 0)
        embed.image = {
            url: imageAttachment,
            proxy_url: imageAttachment
        }

    return embed;
}