'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';
import { SQLUtil } from '../kc/SQLUtil.js';

export default class Stream extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
        this.commands = ['stream', 'mod_stream'];

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS stream_main (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                channel_id VARCHAR(64) NOT NULL
            )`);
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

        const commandName = interaction.commandName;
        const subcommandName = interaction.options.getSubcommand();
        switch(subcommandName) {
        case 'start': {
            return true;
        }
        case 'setchannel': {
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

        const commandName = interaction.commandName;
        const subcommandName = interaction.options.getSubcommand();
        switch(subcommandName) {
        case 'setchannel': {
            return this.setChannel(interaction, guild, channel);
        }
        case 'start': {
            let game = interaction.options.getString('game', true);
            let url = getValidURL(interaction.options.getString('url', true));
            if(url == null) {
                await interaction.reply({ content: this.bot.locale.category("stream", "err_url_bad") });
                return;
            }
            return this.start(interaction, guild, member, game, url);
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
            .setName('stream')
            .setDescription('Collection of Stream related commands.')
            .addSubcommand(subcommand => 
                subcommand.setName('start')
                    .setDescription('Show a stream notification in #community-events that you are currently streaming a KC game.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game you are streaming.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addStringOption(option =>
                        option.setName('url')
                            .setDescription('The link to your stream.')
                            .setRequired(true)
                    )
            ).toJSON(),
            new SlashCommandBuilder()
            .setName('mod_stream')
            .setDescription('[Mod] Collection of Stream related commands.')
            .setDefaultMemberPermissions('0')
            .addSubcommand(subcommand => 
                subcommand.setName('setchannel')
                    .setDescription('[Mod] Set a channel that will receive stream notifications.')
            ).toJSON(),
        ]
    }


    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     */
    setChannel(interaction, guild, channel) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {any[]} */
            let results = (await query(`SELECT channel_id FROM stream_main
                                        WHERE guild_id = '${guild.id}'
                                        FOR UPDATE`)).results;
            if(results.length > 0) {
                await query(`UPDATE stream_main SET channel_id = '${channel.id}'
                            WHERE guild_id = '${guild.id}'`);
            }
            else {
                await query(`INSERT INTO stream_main (guild_id, channel_id)
                            VALUES ('${guild.id}', '${channel.id}')`);
            }

            await interaction.editReply(this.bot.locale.category("stream", "channel_set"));
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {string} game
     * @param {string} url
     */
    start(interaction, guild, member, game, url) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {any} */
            let resultMain = (await query(`SELECT * FROM stream_main WHERE guild_id = '${guild.id}'`)).results[0];

            let channel = (!resultMain || !resultMain.channel_id ? undefined : guild.channels.resolve(resultMain.channel_id));
            if(!(channel instanceof Discord.TextChannel)) {
                await interaction.editReply(this.bot.locale.category("stream", "channel_missing"));
                return;
            }

            let emote = await SQLUtil.getEmote(this.bot.sql, guild.id, game) ?? ':game_die:';

            const embed = getEmbedTemplate(member);
            embed.color = KCUtil.gameEmbedColors[game];
            embed.description = `Streaming ${emote}${KCLocaleManager.getDisplayNameFromAlias("game", game)}\nat ${url}`;

            channel.send({embeds: [embed]});
            await interaction.editReply('Stream notification sent!');
        }).catch(logger.error);
    }
}



/**
 * Validate a streaming service URL.
 * @param {string|null} str - the full URL
 * @returns {string|null} - string if the URL is correct, null if it's invalid.
 */
function getValidURL(str) {
    if(str == null) return null;

    let index =              str.indexOf("twitch.tv/");
    if(index === -1) index = str.indexOf("youtube.com/");
    if(index === -1) index = str.indexOf("youtu.be/");
    if(index === -1) index = str.indexOf("steamcommunity.com/");

    if(index === -1)
        return null;

    let url = str.slice(index, str.length);
    url = "https://" + url;
    return url;
}

/**
 * 
 * @param {Discord.GuildMember=} member 
 * @returns {Discord.APIEmbed}
 */
function getEmbedTemplate(member) {
    /** @type {Discord.APIEmbed} */
    let embed = {
        timestamp: new Date().toISOString(),
    };
    if(member) {
        embed.author = {
            name: member.nickname ?? member.displayName ?? member.user.username,
            icon_url: member.user.avatarURL() || member.user.defaultAvatarURL
        }
    }
    return embed;
}