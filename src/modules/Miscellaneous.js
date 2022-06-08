'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

export default class Miscellaneous extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
        this.commands = ['roll'];
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
        return true;
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel | Discord.ThreadChannel} channel
     */
    async incomingInteraction(interaction, guild, member, channel) {
        const commandName = interaction.commandName;
        switch(commandName) {
        case 'roll': {
            let sides = interaction.options.getInteger('sides');
            this.roll(interaction, sides);
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
            .setName('roll')
            .setDescription('Roll a dice.')
            .addIntegerOption(option =>
                option.setName('sides')
                    .setDescription("The number of sides on the die.")
            ).toJSON(),
        ]
    }


    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {number|null} sides
     */
    roll(interaction, sides) {
        sides = sides ?? 20;
        let roll = Bot.Util.getRandomInt(0, sides) + 1;

        interaction.reply(`[:game_die: D${sides}] rolled \`${roll}\`!`).catch(logger.error);
    }
}