'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

export default class EventLog extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.embedValueLimit = 1024;
        /** @type {Object.<string, string>} */
        this.channelDefs = {
            event: 'cel',
            image: 'cil'
        }
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);

        this.bot.tdb.session(guild, 'eventlog', async session => {
            let document = await this.bot.tdb.findOne(session, guild, 'eventlog', 'main', { }, { _id: 1 }, { });
            if(document && document.channels) {
                for(let key of Object.keys(this.channelDefs))
                    this.cache.set(guild.id, `${key}LogChannel`, document.channels[this.channelDefs[key]]);
            }
        }).catch(logger.error);
    }

    /**
     * Module Function: Set the current channel as the channel for event messages.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @param {string} ext.type - event, image
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    setChannel(m, args, arg, ext) {
        this.bot.tdb.session(m.guild, 'eventlog', async session => {
            await this.bot.tdb.update(session, m.guild, 'eventlog', 'main', { upsert: true }, { _id: 1 }, { [`channels.${this.channelDefs[ext.type]}`]: m.message.channel.id });
            m.channel.send(this.bot.locale.category('eventlog', `${ext.type}_log_channel_add`));
            this.cache.set(m.guild.id, `${ext.type}LogChannel`, m.channel.id);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.Message} message - The message that was sent.
     */
    onMessage(message) {
        const guild = message.guild;
        if(guild == null) return;

        const attachments = Array.from(message.attachments.values())
        if(attachments.length <= 0) return;

        const channelId = this.cache.get(guild.id, 'imageLogChannel');
        if(!channelId) return;

        const channel = guild.channels.resolve(channelId);
        if(!(channel instanceof Discord.TextChannel)) return;

        for(let attachment of attachments) {
            let str = `https://discordapp.com/channels/${guild.id}/${message.channel.id}/${message.id}`;
            channel.send(str, { files: attachments }).catch(logger.error);
        }
    }

    /**
     * @param {Discord.Message} messageOld - The old message.
     * @param {Discord.Message} messageNew - The new message.
     */
    async onMessageUpdate(messageOld, messageNew) {
        //Don't fire on automatically appearing embeds.
        if(messageOld.content === messageNew.content) return;

        const guild = messageOld.guild;
        if(guild == null) return;

        let member = messageOld.member;
        if(member == null) member = await guild.members.fetch(messageOld.author);
        if(member == null) return;

        const channelId = this.cache.get(guild.id, 'eventLogChannel');
        if(!channelId) return;

        const channel = guild.channels.resolve(channelId)
        if(!(channel instanceof Discord.TextChannel)) return;

        let embed = getEmbed.bind(this)(member.user, member.user.id);
        embed.color = 31743;
        embed.description = `[Edited in <#${messageOld.channel.id}>](https://discordapp.com/channels/${guild.id}/${messageOld.channel.id}/${messageOld.id})`;
        embed.fields = [];

        {
            let str = messageOld.content;
            str = parseValue.bind(this)(str);
            if(str.length > 0) {
                embed.fields.push({
                    name: 'Before',
                    value: str,
                    inline: false,
                });
            }
        }

        {
            let str = messageNew.content;
            str = parseValue.bind(this)(str);
            if(str.length > 0) {
                embed.fields.push({
                    name: 'After',
                    value: str,
                    inline: false,
                });
            }
        }

        try {
            let attachments = await getAttachments.bind(this)(messageNew, guild);
            if(attachments.length > 0) {
                embed.image = {
                    url: attachments[0].url
                }
            }
        } catch(err) { logger.error(err); }

        channel.send({embed: embed}).catch(logger.error);
    }
    
    /**
     * @param {Discord.Message|Discord.PartialMessage} message - The message that was deleted.
     */
    async onMessageDelete(message) {
        const guild = message.guild;
        if(guild == null) return;

        let member = message.member;
        if(member == null && message.author) member = await guild.members.fetch(message.author);

        const channelId = this.cache.get(guild.id, 'eventLogChannel');
        if(!channelId) return;

        const channel = guild.channels.resolve(channelId)
        if(!(channel instanceof Discord.TextChannel)) return;

        let embed = getEmbed.bind(this)(member ? member.user : undefined, member ? member.user.id : undefined);
        embed.color = 16761095;
        embed.description = `Deleted in <#${message.channel.id}>`;
        embed.fields = [];

        {
            let str = message.content || 'unknown';
            str = parseValue.bind(this)(str);
            if(str.length > 0) {
                embed.fields.push({
                    name: 'Content',
                    value: str,
                    inline: false,
                });
            }
        }

        try {
            let attachments = await getAttachments.bind(this)(message, guild);
            if(attachments.length > 0) {
                embed.image = {
                    url: attachments[0].url
                }
            }
        } catch(err) { logger.error(err); }

        const guildAuditLogs = await guild.fetchAuditLogs( { limit: 1, type: 'MESSAGE_DELETE' });
        const guildAuditLogsEntry = guildAuditLogs.entries.first();

        if(guildAuditLogsEntry == null) {
            channel.send({embed: embed}).catch(logger.error);
            return;
        }
        /** @type {number} */
        // @ts-ignore
        const count = guildAuditLogsEntry.extra['count']

        const now = Date.now();
        this.bot.tdb.session(guild, 'eventlog', async session => {
            let document = await this.bot.tdb.findOne(session, guild, 'eventlog', 'main', { }, { _id: 1 }, { lastDeleteAudit: 1 });

            /** @type {number|null} */ let lastTimestamp = null;
            let lastCount = 0;
            let modAction = false;

            if(document && document.lastDeleteAudit) {
                lastTimestamp = document.lastDeleteAudit.timestamp;
                lastCount = +document.lastDeleteAudit.count;
            }

            //If we have no entry in the database, fall back on checking if the last audit log happened within the last 10 minutes.
            //At the time of coding, new entries are separated if the difference is 7 minutes or more.
            if(lastTimestamp == null) {
                if(now - guildAuditLogsEntry.createdTimestamp <= 1000 * 60 * 10)
                    modAction = true;
            }
            //If we have an entry in the database, check whether:
            //- The timestamp of the current last audit log entry is newer than the one saved
            //- The timestamp is the same, but the count is higher
            //If either passes, this is a mod action. Otherwise it's self-removal.
            else if(guildAuditLogsEntry.createdTimestamp > lastTimestamp ||
                    (guildAuditLogsEntry.createdTimestamp === lastTimestamp && count > lastCount)) {
                modAction = true;
                
                //Not a mod action if deleting a bot message
                if(guildAuditLogsEntry.target instanceof Discord.User && guildAuditLogsEntry.target.bot)
                    modAction = false;
            }

            await this.bot.tdb.update(session, guild, 'eventlog', 'main', { upsert: true }, { _id: 1 }, {
                _id: 1,
                ['lastDeleteAudit.timestamp']: guildAuditLogsEntry.createdTimestamp,
                ['lastDeleteAudit.count']: count
            });

            if(modAction) {
                embed.color = 1;
                embed.description += `\nMod action by <@${guildAuditLogsEntry.executor.id}>`;
            }

            channel.send({embed: embed}).catch(logger.error);
        }).catch(logger.error);
    }
}

/**
 * @this {EventLog}
 * Shorten an embed value if it's too long.
 * @param {string} str
 * @returns {string}
 */
function parseValue(str) {
    if(str.length > this.embedValueLimit - 2)
        str = str.substring(0, this.embedValueLimit - 3) + '...';

    return str;
}

/**
 * @this {EventLog}
 * Get the attachment of a message.
 * @param {Discord.Message|Discord.PartialMessage} message
 * @param {Discord.Guild} guild
 * @returns {Promise<Discord.MessageAttachment[]>}
 */
async function getAttachments(message, guild) {
    let attachments = Array.from(message.attachments.values());
    let channelId = this.cache.get(guild.id, 'imageLogChannel');
    let channel = guild.channels.resolve(channelId);
    if(!(channel instanceof Discord.TextChannel)) return [];

    let messages = await channel.messages.fetch({ limit: 50 });
    let matchingMessage = messages.find(m => m.content.split('/').reverse()[0] === message.id);

    if(matchingMessage)
        return Array.from(matchingMessage.attachments.values());
    return attachments;
}

/**
 * @this EventLog
 * Get the embed template.
 * @param {Discord.User=} user - The user to make the author of the embed. 
 * @param {Discord.Snowflake=} userId - The user ID to mention in the footer.
 * @returns {Discord.MessageEmbed}
 */
function getEmbed(user, userId) {
    return new Discord.MessageEmbed({
        author: {
            name: user == null ? 'unknown' : user.username + '#' + user.discriminator,
            icon_url: user == null ? undefined : user.avatarURL() || user.defaultAvatarURL
        },
        footer: {
            text: `User ID: ${userId == null ? 'unknown' : userId}`
        },
        timestamp: new Date(),
        fields: []
    });
}