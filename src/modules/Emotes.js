'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';

export default class Emotes extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS emotes_game (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                game VARCHAR(16) NOT NULL,
                emote VARCHAR(64) NOT NULL
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
        const commandName = interaction.commandName;
        switch(commandName) {
        case 'emote': {
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
     * @param {{}} data 
     */
    async incomingInteraction(interaction, guild, member, channel, data) {
        const commandName = interaction.commandName;
        switch(commandName) {
        case 'mod_emote': {
            let game = interaction.options.getString('game', true);
            let emote = interaction.options.getString('emote', true);

            let snowflake = Bot.Util.getSnowflakeFromDiscordPing(emote);
            if(snowflake == null) {
                await interaction.reply({ content: this.bot.locale.category('emotes', 'err_emote_not_correct') });
                return;
            }

            this.emote(interaction, guild, game, emote, snowflake);
            return;
        }
        }
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {string} game
     * @param {string} emote
     * @param {string} id
     */
    emote(interaction, guild, game, emote, id) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            let emoji = guild.emojis.resolve(id);
            if(!emoji) {
                interaction.editReply(this.bot.locale.category('emotes', 'err_emote_not_on_server')).catch(logger.error);
                return;
            }

            /** @type {any[]} */
            let results = (await query(`SELECT game, emote FROM emotes_game
                                        WHERE guild_id = '${guild.id}' AND game = '${game}'
                                        FOR UPDATE`)).results;
            if(results.length > 0) {
                await query(`UPDATE emotes_game SET emote = '${emote}'
                             WHERE guild_id = '${guild.id}' AND game = '${game}'`);
            }
            else {
                await query(`INSERT INTO emotes_game (guild_id, game, emote)
                             VALUES ('${guild.id}', '${game}', '${emote}')`);
            }

            await interaction.editReply(this.bot.locale.category("emotes", "success")).catch(logger.error);
        }).catch(logger.error);
    }
}