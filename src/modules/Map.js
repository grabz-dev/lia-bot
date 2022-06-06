'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/Core')} Message */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */
/** @typedef {import('../kc/KCGameMapManager.js').MapScoreQueryData} KCGameMapManager.MapScoreQueryData */
/** @typedef {import('../kc/KCGameMapManager.js').MapLeaderboardEntry} KCGameMapManager.MapLeaderboardEntry */

import Discord from 'discord.js';
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
            'particlefleet': 'pf',
            'creeperworld3': 'cw3',
            'creeperworld2': 'cw2',
            'creeperworld': 'cw1'
        }

        /** @type {KCGameMapManager|null} */
        this.kcgmm = null;
    }

    /**
     * 
     * @param {KCGameMapManager} kcgmm 
     */
    manualInit(kcgmm) {
        this.kcgmm = kcgmm;
    }

    /** @param {Discord.Message} message */
    onMessage(message) {
        const channel = message.channel;
        if(!(channel instanceof Discord.TextChannel || channel instanceof Discord.ThreadChannel)) return;

        //If the channel name this message was sent in doesn't match our dictionary, don't do anything.
        const game = this.autoMap[channel.name];
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
     * Module Function
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext
     * @param {'map'|'score'|'bestof'} ext.action - Custom parameters provided to function call.
     * @param {KCGameMapManager} ext.kcgmm
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'map':
        case 'bestof':
            let game = args[0];
            //If game parameter is not provided, choose a random game.
            if(game == null) {
                if(ext.action === 'map')
                    game = this.games[Bot.Util.getRandomInt(0, this.games.length)];
                else
                    return this.bot.locale.category('mapdata', 'err_game_name_not_provided'); 
            }

            //If the provided argument is not a Knuckle Cracker game.
            let def = KCLocaleManager.getPrimaryAliasFromAlias('game', game);
            if(def == null)
                return this.bot.locale.category('mapdata', 'err_game_not_correct');
            game = def;

            //If the provided Knuckle Cracker game is not supported.
            let mapListByIds = ext.kcgmm.getMapListId(game);
            if(mapListByIds == null)
                return this.bot.locale.category('mapdata', 'err_game_not_supported', KCLocaleManager.getDisplayNameFromAlias('game', game) + '');

            switch(ext.action) {
            case 'map':
                let mapId = args[1];

                //If the ID is not provided or provided 'random', get a random map.
                if(mapId == null || mapId == 'random')
                mapId = (mapListByIds.random()?.id || 1) + '';

                let id = Number(mapId.replace('#', ''));
                if(id < 0)
                    return this.bot.locale.category('mapdata', 'err_mapid_negative');
                if(!Number.isFinite(id) || id <= 0) {
                    //return this.bot.locale.category('mapdata', 'err_mapid_invalid');
                    let title = arg;
                    title = title.substring(args[0].length + 1)
                    map.call(this, m, game, title, ext.kcgmm).catch(logger.error);
                    return;
                }

                map.call(this, m, game, id, ext.kcgmm).catch(logger.error);
                return;
            case 'bestof':
                args.splice(0, 1);
                let timestamp = Date.parse(args.join(' '));
                if(Number.isNaN(timestamp)) return this.bot.locale.category("mapdata", "err_date_invalid");
                let date = ext.kcgmm.getDateFlooredToMonth(new Date(timestamp));

                let maps = ext.kcgmm.getMapListMonth(game, date.getTime());
                if(maps == null)
                    return this.bot.locale.category('mapdata', 'err_bestof_not_supported', KCLocaleManager.getDisplayNameFromAlias('game', game));
                
                bestof.call(this, m, game, date, maps).catch(logger.error);
                return;
            }
        case 'score':
            const _data = ext.kcgmm.getMapQueryObjectFromCommandParameters(args);
            if(_data.err) return _data.err;
            const msqd = _data.data;

            score.call(this, m, msqd, ext.kcgmm).catch(logger.error);
            return;
        default:
            return;
        }
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
        const subcommandName = interaction.options.getSubcommand();
        switch(commandName) {
        case 'map': return true;
        }

        return false;
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel | Discord.ThreadChannel} channel
     * @param {{ kcgmm: KCGameMapManager }} data 
     */
    async incomingInteraction(interaction, guild, member, channel, data) {
        const commandName = interaction.commandName;
        const subcommandName = interaction.options.getSubcommand();
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

                await this.map(interaction, guild, member, channel, game, data.kcgmm, { id: id, allowTemporaryDelete: false });
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
                await this.map(interaction, guild, member, channel, game, data.kcgmm, { title: title, author: author??undefined, allowTemporaryDelete: false });
                return;
            }
            case 'random': {
                let game = interaction.options.getString('game') ?? this.games[Bot.Util.getRandomInt(0, this.games.length)];
                let mapListByIds = data.kcgmm.getMapListId(game);
                if(mapListByIds == null) {
                    await interaction.reply(this.bot.locale.category('mapdata', 'err_game_not_supported', KCLocaleManager.getDisplayNameFromAlias('game', game) + ''));
                    return;
                }
                let id = mapListByIds.random()?.id || 1;
                await this.map(interaction, guild, member, channel, game, data.kcgmm, { id: id, allowTemporaryDelete: false });
                return;
            }
            }
        }
        }
    }



    //INTERACTION BASED COMMANDS START HERE
    /**
    * @param {Discord.CommandInteraction<"cached">|null} interaction 
    * @param {Discord.Guild} guild
    * @param {Discord.GuildMember} member
    * @param {Discord.TextChannel|Discord.ThreadChannel} channel
    * @param {string} game
    * @param {KCGameMapManager} kcgmm
    * @param {object} opts
    * @param {number=} opts.id
    * @param {string=} opts.title
    * @param {string=} opts.author
    * @param {boolean=} opts.allowTemporaryDelete
    */
    async map(interaction, guild, member, channel, game, kcgmm, opts) {
        if(interaction) await interaction.deferReply();
        const emote = await SQLUtil.getEmote(this.bot.sql, guild.id, game) ?? ':game_die:';

        /** @type {KCGameMapManager.MapData|KCGameMapManager.MapData[]|null} */
        let mapData = null;
        
        //If we are doing an ID search
        if(opts.id != null) {
            //Look for the map
            mapData = kcgmm.getMapById(game, opts.id);
            //If the map is not found, fetch, and look for it again
            if(mapData == null) {
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
            await getMapMessageEmbed.call(this, mapData, emote, guild, game, kcgmm);

        //Edit the interaction if this is an interaction
        if(interaction) {
            await interaction.editReply({ embeds:[embed] }).then(message => {
                if(opts.allowTemporaryDelete) userDeletionHandler(member, message, embed);
            });
        }
        //Otherwise send as regular message
        else {
            await channel.send({ embeds:[embed] }).then(message => {
                if(opts.allowTemporaryDelete) userDeletionHandler(member, message, embed);
            });
        }
    }
}

/**
* Post map information of a specified custom map.
* @this {Map}
* @param {Bot.Message} m - Message of the user executing the command.
* @param {string} game
* @param {number|string} id
* @param {KCGameMapManager} kcgmm
* @param {boolean=} suppressError
* @param {boolean=} allowTemporaryDelete
*/
async function map(m, game, id, kcgmm, suppressError, allowTemporaryDelete) {
    let emote = await SQLUtil.getEmote(this.bot.sql, m.guild.id, game) ?? ':game_die:';

    let mapData = typeof id === 'number' ? kcgmm.getMapById(game, id) : kcgmm.getMapByTitle(game, id);
    if(mapData != null) {
        const singleMap = !(mapData instanceof Array) ? mapData : mapData.length === 1 ? mapData[0] : null;
        if(singleMap != null)
            await fetchMapDescriptionForCW4.call(this, singleMap, kcgmm);

        const embed = mapData instanceof Array ?
            await getMultipleMapsMessageEmbed.call(this, mapData, emote, m.guild, game, kcgmm)
            :
            await getMapMessageEmbed.call(this, mapData, emote, m.guild, game, kcgmm);

        m.channel.send({ embeds:[embed] }).then(message => {
            if(allowTemporaryDelete) userDeletionHandler(m.member, message, embed);
        }).catch(logger.error);
        return;
    }
    else if(typeof id === 'string') {
        m.channel.send("Couldn't find requested map by title. Try with map ID?").catch(logger.error);
        return;
    }

    var str = this.bot.locale.category('mapdata', 'searching_map');
    if(game === 'cw2') str += '\n\n' + this.bot.locale.category('mapdata', 'searching_map_cw2_add');
    m.channel.send(str).then(message => {
        (async () => {
            if(game !== 'cw2')
                await kcgmm.fetch(game);

            let mapData = kcgmm.getMapById(game, id);
            if(!mapData) {
                message.edit(this.bot.locale.category('mapdata', 'search_result_not_found')).catch(logger.error);
                if(suppressError) message.delete();
            }
            else {
                await fetchMapDescriptionForCW4.call(this, mapData, kcgmm);
                message.delete().catch(logger.error);
                const embed = await getMapMessageEmbed.bind(this)(mapData, emote, m.guild, game, kcgmm);
                m.channel.send({ embeds:[embed] }).then(message => {
                    if(allowTemporaryDelete) userDeletionHandler(m.member, message, embed);
                }).catch(logger.error);
            }
        })().catch(e => {
            logger.info(e);
            message.edit(this.bot.locale.category('mapdata', 'search_result_too_fast')).catch(logger.error);
            if(suppressError) message.delete();
        });
    }).catch(logger.error);
}

/**
* Post score information of a specified map.
* @this {Map}
* @param {Bot.Message} m - Message of the user executing the command.
* @param {KCGameMapManager.MapScoreQueryData} mapQueryData 
* @param {KCGameMapManager} kcgmm
*/
async function score(m, mapQueryData, kcgmm) {
    let emote = await SQLUtil.getEmote(this.bot.sql, m.guild.id, mapQueryData.game);

    let embed = getEmbedTemplate.bind(this)(mapQueryData.game, m.guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''), false);
    embed.fields = [];
    var field = {
        name: `${KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${mapQueryData.game}_${mapQueryData.type}`)} Map`,
        value: '',
        inline: false,
    }

    const groupName = mapQueryData.game === 'cw4' ? 'specialevent' : undefined;

    if(mapQueryData.id)
        field.name += `: #${mapQueryData.id}`;
    else if(mapQueryData.type === 'code')
        field.name += `: \`${mapQueryData.name}\` S:${mapQueryData.size} C:${mapQueryData.complexity}`;

    let max = 15;
    let leaderboard = await kcgmm.getMapScores(mapQueryData, undefined, groupName);
    /** @type {KCGameMapManager.MapLeaderboardEntry[]|null} */
    let entries = leaderboard.entries[mapQueryData.objective??0];
    if(entries == null) throw new Error("No leaderboards");

    let longest = 0;
    for(let i = 0; i < Math.min(max, entries.length); i++) {
        const entry = entries[i];
        if(entry.user.length > longest) longest = entry.user.length;
    }

    for(let i = 0; i < Math.min(max, entries.length); i++) {
        const entry = entries[i];
        if(i > 0) field.value += '\n';
        field.value += Bot.Util.String.fixedWidth(`#${entry.rank}`, 3, ' ') + ' ';
        if(entry.time != null) field.value += Bot.Util.String.fixedWidth(KCUtil.getFormattedTimeFromFrames(entry.time), 9, ' ') + ' ';
        else if(entry.score != null) field.value += Bot.Util.String.fixedWidth(entry.score+'', 9, ' ') + ' ';
        else field.value += Bot.Util.String.fixedWidth('', 9, ' ') + ' ';
        field.value += Bot.Util.String.fixedWidth(entry.user, longest, ' ', true);
    }
    field.value = '```\n' + field.value;
    field.value += '\n```';

    if(mapQueryData.game === 'cw4') field.value = `Objective: ${KCLocaleManager.getDisplayNameFromAlias('cw4_objectives', mapQueryData.objective+'')}\n` + field.value;
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

    embed.fields[0] = field;
    m.channel.send({ embeds: [embed] }).catch(logger.error);
}

/**
* Post score information of a specified map.
* @this {Map}
* @param {Bot.Message} m - Message of the user executing the command.
* @param {string} game
* @param {Date} date
* @param {KCGameMapManager.MapData[]} maps
*/
async function bestof(m, game, date, maps) {
    let emote = await SQLUtil.getEmote(this.bot.sql, m.guild.id, game);
    let embed = getEmbedTemplate(game, m.guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''), false);

    let field = {
        name: `${KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${game}_custom`)}: ${KCUtil.getMonthFromDate(date, false)}, ${date.getFullYear()}`,
        value: '',
        inline: false
    }

    for(let i = 0; i < Math.min(maps.length, 7); i++) {
        let str = '';
        let map = maps[i];

        switch(i) {
        case 0: str += ':first_place:'; break;
        case 1: str += ':second_place:'; break;
        case 2: str += ':third_place:'; break;
        case 3: str += ':chocolate_bar:'; break;
        case 4: str += ':lollipop:'; break;
        default: str += ':candy:'; break;
        }

        str += ` **#${map.id}**: ${map.title} __by ${map.author}__. `;
        switch(game) {
        case 'cw3':
        case 'pf': str += `**${map.rating}** rating (${map.ratings})`; break;
        case 'cw4': str += `**${map.upvotes}** thumbsup`
        }

        str += '\n';
        field.value += str;
    }

    if(maps.length <= 0) field.value = 'Nothing to see here.';

    embed.fields.push(field);

    m.channel.send({embeds: [embed]}).catch(logger.error);
}






/**
 * @this Map
 * @param {KCGameMapManager.MapData[]} maps 
 * @param {string} emoteStr 
 * @param {Discord.Guild} guild 
 * @param {string} game 
 * @param {KCGameMapManager} kcgmm
 * @returns {Promise<Discord.MessageEmbed>}
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
 * @returns {Promise<Discord.MessageEmbed>}
 */
async function getMapMessageEmbed(mapData, emoteStr, guild, game, kcgmm) {
    let emoteId = Bot.Util.getSnowflakeFromDiscordPing(emoteStr);
    let emote = emoteId ? guild.emojis.resolve(emoteId) : null;

    /** @type {number|null} */
    let forumMessagesCount = null;

    if(mapData.game === 'cw4' && mapData.guid != null) {
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
    if(game === 'cw2')
        str += `Rating: **${mapData.upvotes}**👍  **${mapData.downvotes}**👎`;
    else if(game === 'cw4')
        str += `Rating: **${mapData.upvotes}**👍`;
    else if(game === 'cw1')
        str += `Rating: **${mapData.rating}/5** (${mapData.ratings} ratings)`;
    else
        str += `Rating: **${mapData.rating}** (${mapData.ratings} ratings)`;
    str += '\n';

    //Tags
    if(mapData.tags) {
        str += `Tags: ${mapData.tags.join(', ')}\n`;
    }
    
    //Forum link
    if(mapData.forumId != null) {
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
            value: mapData.desc,
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
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate(game, emote, thumbnail, thumbnailURL) {
    return new Discord.MessageEmbed({
        color: KCUtil.gameEmbedColors[game],
        author: {
            name: KCLocaleManager.getDisplayNameFromAlias('game', game) || '',
            icon_url: emote ? emote.url : undefined
        },
        thumbnail: thumbnail ? thumbnailURL != null ? {url: thumbnailURL} : ((emote ? {url: emote.url} : undefined)) : undefined,
        fields: [],
    });
}

/**
 * @param {Discord.GuildMember} member
 * @param {Discord.Message} message
 * @param {Discord.MessageEmbed} embed
 */
function userDeletionHandler(member, message, embed) {
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