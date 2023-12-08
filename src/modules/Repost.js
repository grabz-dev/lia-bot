'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
import fetch from 'node-fetch';
import { KCUtil } from '../kc/KCUtil.js';
import { readFile } from 'fs/promises';
import { HttpRequest } from '../utils/HttpRequest.js';

const logger = Bot.logger;

export default class Repost extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
        this.commands = ['repost'];
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

        const roleId = this.bot.getRoleId(guild.id, "MODERATOR");
        if(roleId == null) return false;
        if(member.roles.cache.has(roleId)) return true;
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
        switch(commandName) {
        case 'repost': {
            let id = interaction.options.getInteger('id', true);
            this.repost(interaction, id);
            return;
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
            .setName('repost')
            .setDescription('Repost a Colonies Discord forum map thread.')
            .addIntegerOption(option =>
                option.setName('id')
                    .setDescription("The ID of the map to repost the thread of.")
                    .setRequired(true)
            ).toJSON(),
        ]
    }


    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {number} id
     */
    async repost(interaction, id) {
        let file;
        try {
            file = JSON.parse((await readFile('config/repost.json')).toString())
        }
        catch(e) {
            logger.error(e);
            interaction.reply("An error occurred (1)");
            return;
        }

        if(file == null || typeof file.request_url != 'string') {
            interaction.reply("An error occurred (2)");
            return;
        }
        
        /** @type {string} */
        let requestUrl = file.request_url;
        /** @type {string} */
        let serverId = file.server_id;
        /** @type {string} */
        let channelId = file.channel_id;

        await HttpRequest.get(`${requestUrl}?id=${id}&repost=1&modname=${interaction.user.username}`).then(() => {
            interaction.reply("Request sent successfully").catch(logger.error)
            let guild = interaction.client.guilds.cache.get(serverId);
            if(guild) {
                let channel = guild.channels.cache.get(channelId)
                if(channel instanceof Discord.TextChannel) {
                    channel.send(`${KCUtil.getUserDisplayName(interaction.member, interaction.user)} reposted thread of map ${id}`).catch(logger.error);
                }
            }
        }).catch(e => {
            logger.error(e);
            interaction.reply("An error occurred (3)").catch(logger.error);
        });
    }
}