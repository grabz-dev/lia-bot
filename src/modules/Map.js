'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/Core')} Message */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */
/** @typedef {import('../kc/KCGameMapManager.js').MapScoreQueryData} KCGameMapManager.MapScoreQueryData */
/** @typedef {import('../kc/KCGameMapManager.js').MapLeaderboardEntry} KCGameMapManager.MapLeaderboardEntry */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';
import { SQLUtil } from '../kc/SQLUtil.js';
import { HttpRequest } from '../utils/HttpRequest.js';
import xml2js from 'xml2js';

export default class Map extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
        this.commands = ['map', 'score', 'bestof'];

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS map_cw4_descriptions (
                id INT UNSIGNED PRIMARY KEY,
                description VARCHAR(1024) NOT NULL
             )`);
        }).catch(logger.error)


        this.games = ['cw1', 'cw2', 'cw3', 'pf', 'cw4'];
        /** @type {Object.<string, string>} */
        this.autoMap = {
            'creeperworld4': 'cw4',
            'colonies-custom-maps': 'cw4',
            'particlefleet': 'pf',
            'creeperworld3': 'cw3',
            'creeperworld2': 'cw2',
            'creeperworld': 'cw1'
        }

        /** @type {KCGameMapManager|null} */
        this.kcgmm = null;

        /** @type {import('./DMD.js').default|null} */
        this.dmd = null;
    }

    /** @param {Discord.Message} message */
    onMessage(message) {
        const channel = message.channel;
        if(!(channel instanceof Discord.TextChannel || channel instanceof Discord.ThreadChannel)) return;

        //If the channel name this message was sent in doesn't match our dictionary, don't do anything.

        let channelName = ''

        if(channel instanceof Discord.ThreadChannel) {
            if(channel.parent) {
                channelName = channel.parent.name;
            }
        }
        else {
            channelName = channel.name;
        }

        const game = this.autoMap[channelName];
        if(game == null) return;

        //Split the message by all instances of the character #
        var str = message.content;
        var arr = str.split("#");
        //If none found, don't do anything
        if(arr.length <= 1) return;

        (async () => {
            var count = 0;
            //Go through all the splits, ignoring the first one which is either empty or meaningless.
            for(let i = 1; i < arr.length; i++) {
                //Discard entries not beginning with a space if not at the beginning of the message
                const leadingChar = arr[i - 1].slice(-1);
                if(i - 1 === 0) {
                    if(leadingChar !== '' && leadingChar !== ' ') continue;
                }
                else if(leadingChar !== ' ') continue;

                //Discard all non alphanumeric characters from this split.
                const id = +arr[i].split(/[^a-zA-Z0-9]/)[0];
                //If the result is not a number, discard this split.
                //If string is empty it gets coerced to 0, which is fine because we want to discard those anyway.
                //Discard numbers which are way too high, as those are likely Discord id's (when linking channels).
                if(id <= 0 || id > 1000000 || Number.isNaN(id) || !Number.isFinite(id)) continue;
                //Under normal circumstances, all checks have passed.
                if(message.guild != null && message.member != null && this.kcgmm != null) {
                    await this.map(null, message.guild, message.member, channel, game, this.kcgmm, { id: id, allowTemporaryDelete: true });
                    count++;
                }
                //Don't post more than 2 map embeds, even if more valid splits are found.
                if(count >= 2) break;
            }
        })();
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
        case 'map':
        case 'score':
        case 'bestof': {
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
        if(!interaction.isChatInputCommand()) return;

        if(this.kcgmm == null) {
            logger.error("Not initialized.");
            return;
        };

        const commandName = interaction.commandName;
        const subcommandName = interaction.options.getSubcommand(false);
        switch(commandName) {
        case 'map': {
            switch(subcommandName) {
            case 'id': {
                let game = interaction.options.getString('game', true);
                let id = interaction.options.getInteger('id', true);
                if(id < 0) {
                    await interaction.reply({ content: this.bot.locale.category('mapdata', 'err_mapid_negative'), ephemeral: true });
                    return;
                }
                if(!Number.isFinite(id) || id <= 0) {
                    await interaction.reply({ content: this.bot.locale.category('mapdata', 'err_mapid_invalid'), ephemeral: true });
                    return;
                }

                await this.map(interaction, guild, member, channel, game, this.kcgmm, { id: id, allowTemporaryDelete: false });
                return;
            }
            case 'title': {
                let game = interaction.options.getString('game', true);
                let title = interaction.options.getString('title', true);
                let author = interaction.options.getString('author');
                if(title.length < 3) {
                    await interaction.reply({ content: 'Title length must be at least three characters.', ephemeral: true });
                    return;
                }
                await this.map(interaction, guild, member, channel, game, this.kcgmm, { title: title, author: author??undefined, allowTemporaryDelete: false });
                return;
            }
            case 'random': {
                let game = interaction.options.getString('game') ?? this.games[Bot.Util.getRandomInt(0, this.games.length)];
                let mapListByIds = this.kcgmm.getMapListId(game);
                if(mapListByIds == null) {
                    await interaction.reply(this.bot.locale.category('mapdata', 'err_game_not_supported', KCLocaleManager.getDisplayNameFromAlias('game', game) + ''));
                    return;
                }
                let id = mapListByIds.random()?.id || 1;
                await this.map(interaction, guild, member, channel, game, this.kcgmm, { id: id, allowTemporaryDelete: false });
                return;
            }
            }
        }
        case 'score': {
            let type = interaction.options.getString('type', true);
            let game = interaction.options.getString('game');
            let id = interaction.options.getInteger('id');
            let objective = interaction.options.getString('objective');
            let seed = interaction.options.getString('seed');
            let date = interaction.options.getString('date');
            let size = interaction.options.getString('size');
            let complexity = interaction.options.getString('complexity');
            let campaign = interaction.options.getString('campaign');
            let userfilter = interaction.options.getString('userfilter');
            let groupfilter = interaction.options.getString('groupfilter');
            
            const data = this.kcgmm.getMapQueryObjectFromCommandParameters(type, game, id, objective, seed, date, size, complexity, campaign);
            if(data.err != null) {
                await interaction.reply({ content: data.err });
            }
            else {
                await this.score(interaction, guild, data.data, this.kcgmm, userfilter??undefined, groupfilter??undefined);
            }

            return;
        }
        case 'bestof': {
            let game = interaction.options.getString('game', true);
            let dateInput = interaction.options.getString('date', true);
            let timestamp = Date.parse(dateInput);
            if(Number.isNaN(timestamp)) {
                await interaction.reply({ content: this.bot.locale.category("mapdata", "err_date_invalid") });
                return;
            }
            let date = this.kcgmm.getDateFlooredToMonth(new Date(timestamp));
            let maps = this.kcgmm.getMapListMonth(game, date.getTime());
            if(maps == null) {
                await interaction.reply({ content: this.bot.locale.category('mapdata', 'err_bestof_not_supported', KCLocaleManager.getDisplayNameFromAlias('game', game)) });
                return;
            }

            await this.bestof(interaction, guild, game, date, maps);
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
            .setName('map')
            .setDescription('Display information about a map.')
            .addSubcommand(subcommand =>
                subcommand.setName('id')
                    .setDescription('Display information about a map, searching by ID.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game the map is from.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addIntegerOption(option =>
                        option.setName('id')
                            .setDescription('The map ID number.')
                            .setRequired(true)
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('title')
                    .setDescription('Display information about a map, searching by map title.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game the map is from.')
                            .setRequired(true)
                            .addChoices(...KCUtil.slashChoices.game)
                    ).addStringOption(option =>
                        option.setName('title')
                            .setDescription('The full or partial map title to search (case insensitive).')
                            .setRequired(true)
                    ).addStringOption(option =>
                        option.setName('author')
                            .setDescription('The name of the map author (case insensitive).')
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('random')
                    .setDescription('Display information about a map, choosing a random one.')
                    .addStringOption(option =>
                        option.setName('game')
                            .setDescription('The game to pick randomly from. Omit to also pick a random game.')
                            .addChoices(...KCUtil.slashChoices.game)
                    )
            ).toJSON(),
            /** @type {SlashCommandBuilder} */(KCUtil.fillScoreSlashCommandChoices(new SlashCommandBuilder()
            .setName('score')
            .setDescription('Display scores of a map.')
            )).addStringOption(option =>
                option.setName('userfilter')
                    .setDescription('Filter by user name. Leave empty to not filter by user name.')
            ).addStringOption(option =>
                option.setName('groupfilter')
                    .setDescription('Filter by group. Leave empty to not filter by group. We often use the specialevent group name.')
            ).toJSON(),
            new SlashCommandBuilder()
            .setName('bestof')
            .setDescription('Display a list of the highest rated maps from a given month.')
            .addStringOption(option =>
                option.setName('game')
                    .setDescription('The game the maps should be from.')
                    .setRequired(true)
                    .addChoices(...KCUtil.slashChoices.game)
            ).addStringOption(option =>
                option.setName('date')
                    .setDescription('The month to pick. Example date format: 2022-06')
                    .setRequired(true)
            ).toJSON(),
        ]
    }


    /**
    * @param {Discord.CommandInteraction<"cached">|null} interaction 
    * @param {Discord.Guild} guild
    * @param {Discord.GuildMember|null} member
    * @param {Discord.TextChannel|Discord.ThreadChannel} channel
    * @param {string} game
    * @param {KCGameMapManager} kcgmm
    * @param {object} opts
    * @param {number=} opts.id
    * @param {string=} opts.title
    * @param {string=} opts.author
    * @param {boolean=} opts.allowTemporaryDelete
    * @param {boolean=} opts.permanentOnly
    * @returns {Promise<Discord.Message|undefined>}
    */
    async map(interaction, guild, member, channel, game, kcgmm, opts) {
        if(interaction && !interaction.deferred) await interaction.deferReply();
        const emote = await SQLUtil.getEmote(this.bot.sql, guild.id, game) ?? ':game_die:';

        /** @type {KCGameMapManager.MapData|KCGameMapManager.MapData[]|null} */
        let mapData = null;
        
        //If we are doing an ID search
        if(opts.id != null) {
            //Look for the map
            mapData = kcgmm.getMapById(game, opts.id);
            //If the map is not found, fetch, and look for it again
            if(mapData == null) {
                let mapArr = kcgmm.getMapListArray(game);
                if(mapArr != null && opts.id < mapArr.reduce((p, c) => p = c.id > p ? c.id : p, 0)) {
                    if(interaction) await interaction.editReply({ content: `Map #${opts.id} was deleted.` })
                    return;
                }
                if(game !== 'cw2') {
                    try {
                        await kcgmm.fetch(game);
                    } catch {
                        //Exit if fetch has failed (too quick)
                        if(interaction) {
                            let str = `I couldn't find map #${opts.id}.`;
                            if(game !== 'cw2') str += ` If you're certain this map exists, try again in a few minutes.`;
                            await interaction.editReply({ content: str });
                        }
                        return;
                    }
                }
                mapData = kcgmm.getMapById(game, opts.id);
            }
            //If the map is not found the second time, we ain't got it chief
            if(mapData == null) {
                if(interaction) await interaction.editReply({ content: this.bot.locale.category('mapdata', 'search_result_not_found') });
                return;
            }
        }
        //If we are doing a title search
        else if(opts.title != null) {
            //Look for the map(s)
            mapData = kcgmm.getMapByTitle(game, opts.title, opts.author??undefined);
            //If no maps were found, it ain't here
            if(mapData == null) {
                if(interaction) await interaction.editReply({ content: `I couldn't find any maps matching the provided title.`})
                return;
            }
        }

        //If somehow wrong input was provided and neither of the previous statements fired
        if(mapData == null) {
            if(interaction) await interaction.editReply({ content: `An unexpected error occurred.`});
            return;
        }

        //If we only found one map
        if(!(mapData instanceof Array)) {
            //Fetch its description
            await fetchMapDescriptionForCW4.call(this, mapData, kcgmm);
        }

        //Create message embed
        const embed = mapData instanceof Array ?
            await getMultipleMapsMessageEmbed.call(this, mapData, emote, guild, game, kcgmm)
            :
            await getMapMessageEmbed.call(this, mapData, emote, guild, game, kcgmm, {permanentOnly: opts.permanentOnly});

        /** @type {Discord.Message=} */
        let message;
        //Edit the interaction if this is an interaction
        if(interaction) {
            message = await interaction.editReply({ embeds:[embed] });
        }
        //Otherwise send as regular message
        else {
            message = await channel.send({ embeds:[embed] });
        }

        /** @type {Discord.Message=} */
        let forumMessage;
        if(!(mapData instanceof Array) && mapData.discordId != null && this.autoMap[channel.name] != null) {
            let forumChannel = await message.guild?.channels.fetch(mapData.discordId).catch(() => undefined);
            // @ts-ignore
            if(forumChannel != null && forumChannel.send != null)
                forumMessage = await /** @type {Discord.TextChannel} */(forumChannel)?.send(`This map was mentioned here: https://discord.com/channels/${channel.guildId}/${channel.id}/${message.id}`).catch(() => undefined);
        }

        if(opts.allowTemporaryDelete && member) userDeletionHandler(member, message, embed, forumMessage);

        return message;
    }

    /**
    * @param {Discord.CommandInteraction<"cached">} interaction 
    * @param {Discord.Guild} guild
    * @param {KCGameMapManager.MapScoreQueryData} mapQueryData 
    * @param {KCGameMapManager} kcgmm
    * @param {string=} userName
    * @param {string=} groupName
    */
    async score(interaction, guild, mapQueryData, kcgmm, userName, groupName) {
        await interaction.deferReply();
        let emote = await SQLUtil.getEmote(this.bot.sql, guild.id, mapQueryData.game);

        let embed = getEmbedTemplate.bind(this)(mapQueryData.game, guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''), false);
        embed.fields = [];
        var field = {
            name: `${KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${mapQueryData.game}_${mapQueryData.type}`)} Map`,
            value: '',
            inline: false,
        }

        //if(mapQueryData.game === 'cw4' && mapQueryData.type !== 'chronom') {
        //    groupName = 'specialevent';
        //}
        let isUserFilterPF = mapQueryData.game === 'pf' && userName != null;

        if(mapQueryData.id)
            field.name += `: #${mapQueryData.id}`;
        else if(mapQueryData.type === 'code')
            field.name += `: \`${mapQueryData.name}\``;

        let max = 15;
        let leaderboard = await kcgmm.getMapScores(mapQueryData, userName, groupName);
        if(leaderboard == null) {
            await interaction.editReply({ content: "Failed to get map scores." });
            return;
        }
        /** @type {KCGameMapManager.MapLeaderboardEntry[]} */
        let entries = leaderboard.entries[mapQueryData.objective??0]??[];

        let longest = 0;
        for(let i = 0; i < Math.min(max, entries.length); i++) {
            const entry = entries[i];
            if(entry.user.length > longest) longest = entry.user.length;
        }

        for(let i = 0; i < Math.min(max, entries.length); i++) {
            const entry = entries[i];
            if(i > 0) field.value += '\n';
            if(isUserFilterPF && entry.user.toLowerCase() === userName?.toLowerCase()) field.value += '> ';
            if(isUserFilterPF) field.value += `#${entry.rank}`;
            else field.value += Bot.Util.String.fixedWidth(`#${entry.rank}`, isUserFilterPF ? 6 : 3, ' ') + ' ';
            if(entry.time != null) field.value += Bot.Util.String.fixedWidth(KCUtil.getFormattedTimeFromFrames(entry.time), 9, ' ') + ' ';
            else if(entry.score != null) field.value += Bot.Util.String.fixedWidth(entry.score+'', 9, ' ') + ' ';
            else field.value += Bot.Util.String.fixedWidth('', 9, ' ') + ' ';
            field.value += Bot.Util.String.fixedWidth(entry.user, longest, ' ', true);
        }
        field.value = '```\n' + (field.value.length === 0 ? 'No scores' : field.value);
        field.value += '\n```';

        if(mapQueryData.size != null) field.value = `Size: ${KCLocaleManager.getDisplayNameFromAlias('cw2_code_map_size', mapQueryData.size+'')}\n` + field.value;
        if(mapQueryData.complexity != null) field.value = `Complexity: ${KCLocaleManager.getDisplayNameFromAlias('cw2_code_map_complexity', mapQueryData.complexity+'')}\n` + field.value;
        if(mapQueryData.gameUID != null) {
            let name = kcgmm.getCampaignMapNameFromGUID(mapQueryData.game, mapQueryData.gameUID);
            if(name == null) field.value = `GUID: ${mapQueryData.gameUID}\n` + field.value;
            else field.name = name;
        }
        if(mapQueryData.game === 'cw4') field.value = `Objective: ${KCLocaleManager.getDisplayNameFromAlias('cw4_objectives', mapQueryData.objective+'')}\n` + field.value;
        if(userName != null) field.value = `User Filter: ${userName}\n` + field.value;
        if(groupName != null) field.value = `Group Filter: ${groupName}\n` + field.value;
        if(mapQueryData.game === 'cw4' && mapQueryData.type === 'markv') {
            field.value = mapQueryData.name + '\n' + field.value;
        }
        if(mapQueryData.game === 'cw4' && mapQueryData.timestamp != null) {
            let date = new Date(mapQueryData.timestamp);
            field.value = `${KCUtil.getMonthFromDate(date, false)} ${KCUtil.getDayFromDate(date)}, ${date.getFullYear()}\n` + field.value;
        }
        if(mapQueryData.id) {
            const map = kcgmm.getMapById(mapQueryData.game, mapQueryData.id);
            if(map != null) {
                field.value = `${map.title} __by ${map.author}__\n` + field.value;
            }
        }
        if(this.dmd != null && mapQueryData.type === 'dmd' && mapQueryData.id) {
            let dmdMap = await this.dmd.getDMDMapInfo(mapQueryData.id);
            if(dmdMap != null) {
                field.value = `${dmdMap.name} __by ${dmdMap.owner}__\n` + field.value;
            }
        }

        embed.fields[0] = field;
        await interaction.editReply({ embeds: [embed] });
    }

    /**
    * @param {Discord.CommandInteraction<"cached">} interaction 
    * @param {Discord.Guild} guild
    * @param {string} game
    * @param {Date} date
    * @param {KCGameMapManager.MapData[]} maps
    */
    async bestof(interaction, guild, game, date, maps) {
        await interaction.deferReply();
        let emote = await SQLUtil.getEmote(this.bot.sql, guild.id, game);
        let embed = getEmbedTemplate(game, guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''), false);

        let field = {
            name: `${KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${game}_custom`)}: ${KCUtil.getMonthFromDate(date, false)}, ${date.getFullYear()}`,
            value: '',
            inline: false
        }

        for(let i = 0; i < Math.min(maps.length, 7); i++) {
            let str = '';
            let map = maps[i];

            str += `${i + 1}: `;

            str += ` **#${map.id}**: ${map.title} __by ${map.author}__. `;
            switch(game) {
            case 'cw3':
            case 'pf': str += `**${map.rating}** rating (${map.ratings})`; break;
            case 'cw4': str += `**${map.upvotes}** 👍`
            }

            str += '\n';
            field.value += str;
        }

        if(maps.length <= 0) field.value = 'Nothing to see here.';
        else field.value += `\nList chosen from ${maps.length} maps.`;

        if(embed.fields == null) embed.fields = [];
        embed.fields.push(field);

        await interaction.editReply({embeds: [embed]});
    }
}






/**
 * @this Map
 * @param {KCGameMapManager.MapData[]} maps 
 * @param {string} emoteStr 
 * @param {Discord.Guild} guild 
 * @param {string} game 
 * @param {KCGameMapManager} kcgmm
 * @returns {Promise<Discord.APIEmbed>}
 */
async function getMultipleMapsMessageEmbed(maps, emoteStr, guild, game, kcgmm) {
    let emoteId = Bot.Util.getSnowflakeFromDiscordPing(emoteStr);
    let emote = emoteId ? guild.emojis.resolve(emoteId) : null;

    let embed = getEmbedTemplate.bind(this)(game, emote, false);
    embed.description = '';

    let i = 0;
    for(const map of maps) {
        let title = map.title;
        if(map.forumId != null) title = `[${title}](https://knucklecracker.com/forums/index.php?topic=${map.forumId})`;
        embed.description += `**Map #${map.id}** - ${title} __by ${map.author}__\n`;
        i++;
        if(i >= 10) {
            embed.description += `...and ${maps.length - i} more maps.`;
            break;
        }
    }

    return embed;
}

/**
 * @this Map
 * @param {KCGameMapManager.MapData} mapData 
 * @param {string} emoteStr 
 * @param {Discord.Guild} guild 
 * @param {string} game 
 * @param {KCGameMapManager} kcgmm
 * @param {object} opts
 * @param {boolean=} opts.permanentOnly //Only display permanent information, so exclude ratings/forum comment count
 * @returns {Promise<Discord.APIEmbed>}
 */
async function getMapMessageEmbed(mapData, emoteStr, guild, game, kcgmm, opts) {
    let emoteId = Bot.Util.getSnowflakeFromDiscordPing(emoteStr);
    let emote = emoteId ? guild.emojis.resolve(emoteId) : null;

    /** @type {number|null} */
    let forumMessagesCount = null;

    if(mapData.game === 'cw4' && mapData.guid != null && !opts.permanentOnly) {
        var xml = await HttpRequest.get(`https://knucklecracker.com/creeperworld4/queryMapDetail.php?guid=${mapData.guid}`).catch(() => {});
        if(xml != null) {
            let data = await xml2js.parseStringPromise(xml).catch(() => {});
            forumMessagesCount = data?.d?.c[0] ?? null;
        }
    }

    let thumbnailURL = '';
    if(mapData.id && mapData.id > 0) {
        if(game === 'cw1')
            thumbnailURL = `https://knucklecracker.com/creeperworld/thumb.php?id=${mapData.id}`;
        else if(game === 'cw2')
            thumbnailURL = `https://knucklecracker.com/creeperworld2/thumb.php?id=${mapData.id}`;
        else
            thumbnailURL = `https://knucklecracker.com/${KCLocaleManager.getUrlStringFromPrimaryAlias(game)}/queryMaps.php?query=thumbnail&guid=${mapData.guid}`;
    }

    let embed = getEmbedTemplate.bind(this)(game, emote, true, thumbnailURL);
    //embed.image = {
    //    url: thumbnailURL
    //}

    let str = '';

    //Author
    str += `Author: **${mapData.author}**\n`;

    //Width/Height
    if(game === 'cw2')
        str += `Height: ${mapData.height}\n`;
    else if(mapData.width != null && mapData.height != null) {
        str += `Size: ${mapData.width}x${mapData.height}`;

        //CW4 version
        if(mapData.version != null) {
            str += `, Ver: ${mapData.version}`;
        }

        str += '\n';
    }

    //Scores/Downloads
    if(mapData.scores != null && mapData.downloads != null) {
        str += `Scores/Downloads: ${mapData.scores} : ${mapData.downloads}`;
        if(mapData.downloads > 0) str += ` (${Math.round(mapData.scores / mapData.downloads * 1000) / 1000})`;
        str += '\n';
    }

    //Objectives
    if(mapData.game === 'cw4' && mapData.objectives != null) {
        str += `Objectives: ${kcgmm.getCW4ObjectivesArray(mapData.objectives).reduce((acc, v, i) => acc += v ? KCLocaleManager.getDisplayNameFromAlias('cw4_objectives', i+'') + ', ' : '', '')}`;
        str = str.substring(0, str.length - 2);
        str += '\n';
    }

    //Rating/Upvotes/Downvotes
    if(!opts.permanentOnly) {
        if(game === 'cw2')
            str += `Rating: **${mapData.upvotes}**👍  **${mapData.downvotes}**👎`;
        else if(game === 'cw4')
            str += `Rating: **${mapData.upvotes}**👍`;
        else if(game === 'cw1')
            str += `Rating: **${mapData.rating}/5** (${mapData.ratings} ratings)`;
        else
            str += `Rating: **${mapData.rating}** (${mapData.ratings} ratings)`;
        str += '\n';
    }

    //Tags
    if(mapData.tags) {
        str += `Tags: ${mapData.tags.join(', ')}\n`;
    }
    
    //Forum link
    if(mapData.discordId != null && mapData.discordId.length > 0) {
        /** @type {string|null} */
        let messageCount = null;
        const thread = /** @type {any} */(await guild.channels.fetch(mapData.discordId));
        if(thread instanceof Discord.ThreadChannel) {
            if(thread.messageCount == null) messageCount = null;
            else messageCount = thread.messageCount >= 50 ? '50+' : `${thread.messageCount}`;
        }
        str += `[Discord Thread ${messageCount != null ? `(${messageCount} comment${messageCount != '1' ? 's':''})` : ''}](https://discord.com/channels/192420539204239361/${mapData.discordId}/)\n`;
    }
    else if(mapData.forumId != null) {
        str += `[Forum Thread ${forumMessagesCount != null ? `(${forumMessagesCount} comment${forumMessagesCount != 1 ? 's':''})` : ''}](https://knucklecracker.com/forums/index.php?topic=${mapData.forumId})\n`;
    }

    //ID/Title
    embed.fields = [{
        name: ':map: Map #' + mapData.id + ': ' + mapData.title,
        value: str,
        inline: false
    }];
    
    //Desc
    if(mapData.desc != null && mapData.desc.length > 0) {
        embed.fields.push({
            name: ':envelope: Description',
            value: mapData.desc.replaceAll('https://', '').replaceAll('http://', ''),
            inline: false
        });
    }

    if(mapData.timestamp != null) {
        embed.footer = {
            text: `Map uploaded ${Bot.Util.getFormattedDate(mapData.timestamp, false)}`
        }
    }

    return embed;
}

/**
 * @this Map
 * @param {string} game
 * @param {Discord.GuildEmoji|null} emote
 * @param {boolean} thumbnail
 * @param {string=} thumbnailURL
 * @returns {Discord.APIEmbed}
 */
function getEmbedTemplate(game, emote, thumbnail, thumbnailURL) {
    return {
        color: KCUtil.gameEmbedColors[game],
        author: {
            name: KCLocaleManager.getDisplayNameFromAlias('game', game) || '',
            icon_url: emote ? emote.url : undefined
        },
        thumbnail: thumbnail ? thumbnailURL != null ? {url: thumbnailURL} : ((emote ? {url: emote.url} : undefined)) : undefined,
        fields: [],
    };
}

/**
 * @param {Discord.GuildMember} member
 * @param {Discord.Message} message
 * @param {Discord.APIEmbed} embed
 * @param {Discord.Message=} forumMessage
 */
function userDeletionHandler(member, message, embed, forumMessage) {
    const collector = message.createReactionCollector({
        time: 1000 * 60 * 1,
    })

    collector.on('collect', async (reaction, user) => {
        //do not remove if bot
        if(message.member && user.id === message.member.id) return;
        await reaction.users.remove(user);

        if(user.id === member.id) {
            switch(reaction.emoji.name) {
            case '❌':
                message.delete().catch(logger.error);
                if(forumMessage != null) forumMessage.delete().catch(logger.error); 
                break;
            }
        }
    });

    collector.on('end', async () => {
        await message.reactions.removeAll().catch(() => {});
    });

    message.react('❌').catch(logger.error);
}

/**
 * @this {Map}
 * @param {KCGameMapManager.MapData} map 
 * @param {KCGameMapManager} kcgmm
 */
async function fetchMapDescriptionForCW4(map, kcgmm) {
    if(map.game !== 'cw4') return;

    await this.bot.sql.transaction(async query => {
        let result = (await query(`SELECT * FROM map_cw4_descriptions WHERE id = ?`, map.id)).results[0];
        if(result != null) {
            map.desc = result.description;
            return;
        }
        if(map.guid == null) return;
        logger.info(`Downloading description from CW4 map ${map.id}`);
        let desc = await kcgmm.getCW4MapDescriptionFromCW4MapDownload(map.guid);
        await query(`INSERT INTO map_cw4_descriptions (id, description) VALUES (?, ?)`, [map.id, desc]);
        map.desc = desc;
    }).catch(logger.error);
}