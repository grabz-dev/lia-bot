'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import("../kc/KCGameMapManager").MapData} KCGameMapManager.MapData} */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCUtil } from '../kc/KCUtil.js';
import { KCLocaleManager } from '../kc/KCLocaleManager.js';


export default class AutoPost extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
        this.commands = ['autopost'];

        /** @type {KCGameMapManager|null} */
        this.kcgmm = null;
        /** @type {import('./Map.js').default|null} */
        this.map = null;

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS autopost_setup (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                cw3_channel_id VARCHAR(64),
                cw4_channel_id VARCHAR(64)
            )`);
            await query(`CREATE TABLE IF NOT EXISTS autopost_cw3 (
                id INT UNSIGNED PRIMARY KEY,
                channel_id VARCHAR(64) NOT NULL,
                thread_id VARCHAR(64) NOT NULL
            )`);
            await query(`CREATE TABLE IF NOT EXISTS autopost_cw4 (
                id INT UNSIGNED PRIMARY KEY,
                channel_id VARCHAR(64) NOT NULL,
                thread_id VARCHAR(64) NOT NULL
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
        const subcommandName = interaction.options.getSubcommand();
        switch(subcommandName) {
        case 'setchannel': {
            let game = interaction.options.getString('game', true);
            this.setChannel(interaction, guild, game);
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
            .setName('autopost')
            .setDescription('[Mod] Collection of AutoPost related commands.')
            .setDefaultMemberPermissions('0')
            .addSubcommand(subcommand => 
                subcommand.setName('setchannel')
                    .setDescription('[Mod] Set channel for autopost.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to assign the emote for.')
                            .setRequired(true)
                            .addChoices(...[
                                Object.freeze({ name: 'Creeper World 4', value: 'cw4' }),
                                Object.freeze({ name: 'Creeper World 3', value: 'cw3' }),
                            ])
                    )
            ).toJSON(),
        ]
    }

    /**
     * 
     * @param {Discord.Guild} guild 
     */
    loop(guild) {
        this.bot.sql.transaction(async query => {
            for(let game of ['cw3', 'cw4']) {
                if(this.kcgmm == null || this.map == null) continue;
                let setup = (await query(`SELECT * FROM autopost_setup`)).results[0];
                if(setup == null || setup[`${game}_channel_id`] == null) continue;
                let channelId = setup[`${game}_channel_id`];
                let mapList = this.kcgmm.getMapListArray(game);
                if(mapList == null) continue;
                mapList.sort((a, b) => a.id - b.id);

                /** @type {KCGameMapManager.MapData[]}*/
                let mapsCreateThreads = [];

                let lastPost = (await query(`SELECT MAX(id) FROM autopost_${game}`)).results[0]['MAX(id)'];
                if(lastPost == null) {
                    for(let i = mapList.length - 10; i < mapList.length; i++)
                        mapsCreateThreads.push(mapList[i]);
                }
                else {
                    mapsCreateThreads = mapList.reduce((p, c) => {
                        if(c.id > lastPost) p.push(c);
                        return p;
                    }, /** @type {KCGameMapManager.MapData[]}*/([]))
                }
                if(mapsCreateThreads.length === 0) continue;

                let channel = guild.channels.cache.get(channelId);
                if(!(channel instanceof Discord.TextChannel)) continue;

                for(let map of mapsCreateThreads) {
                    let duplicate = (await query(`SELECT * FROM autopost_${game} WHERE id = ?`, [map.id])).results[0];
                    if(duplicate) continue;
                    let thread = await channel.threads.create({
                        name: `Map ${map.id} • ${map.title} • by ${map.author}`,
                        autoArchiveDuration: "MAX"
                    });
                    await query(`INSERT INTO autopost_${game} (id, channel_id, thread_id) VALUES (?, ?, ?)`, [map.id, channelId, thread.id]);

                    let mapMessage = await this.map.map(null, guild, null, thread, game, this.kcgmm, {
                        id: map.id,
                        permanentOnly: true
                    });
                    if(mapMessage == null) logger.error(new Error('Failed to create map message'));
                    else await mapMessage.pin();
                    await Bot.Util.Promise.sleep(6000);
                }
            }
        }).catch(logger.error);
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {string} game 
     */
    setChannel(interaction, guild, game) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            let setup = (await query('SELECT * FROM autopost_setup')).results[0];
            if(setup == null) {
                await query(`INSERT INTO autopost_setup (${game}_channel_id) VALUES (?)`, [interaction.channelId]);
            }
            else {
                await query(`UPDATE autopost_setup SET ${game}_channel_id = ?`, [interaction.channelId]);
            }
            await interaction.editReply(`Channel set for ${KCLocaleManager.getDisplayNameFromAlias("game", game)}.`);

        }).catch(logger.error);
    }
}