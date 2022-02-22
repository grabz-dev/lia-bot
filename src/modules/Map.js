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
import { HttpRequest } from '../utils/HttpRequest.js';
import xml2js from 'xml2js';

export default class Map extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.games = ['cw2', 'cw3', 'pf', 'cw4'];
        /** @type {Object.<string, string>} */
        this.autoMap = {
            'creeperworld4': 'cw4',
            'particlefleet': 'pf',
            'creeperworld3': 'cw3',
            'creeperworld2': 'cw2'
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
        if(!(channel instanceof Discord.TextChannel)) return;

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
                    await map.call(this, { channel: channel, guild: message.guild, member: message.member, message: message }, game, id, this.kcgmm, true, true);
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
    let emote = ':game_die:';
    await this.bot.sql.transaction(async query => {
        let result = (await query(`SELECT * FROM emotes_game
                                   WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
        if(result) emote = result.emote;
    }).catch(logger.error);

    let mapData = typeof id === 'number' ? kcgmm.getMapById(game, id) : kcgmm.getMapByTitle(game, id);
    if(mapData != null) {
        const embed = mapData instanceof Array ?
            await getMultipleMapsMessageEmbed.call(this, mapData, emote, m.guild, game, kcgmm)
            :
            await getMapMessageEmbed.call(this, mapData, emote, m.guild, game, kcgmm);

        m.channel.send({ embeds:[embed] }).then(message => {
            if(allowTemporaryDelete) userDeletionHandler(m, message, embed);
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
                message.delete().catch(logger.error);
                const embed = await getMapMessageEmbed.bind(this)(mapData, emote, m.guild, game, kcgmm);
                m.channel.send({ embeds:[embed] }).then(message => {
                    if(allowTemporaryDelete) userDeletionHandler(m, message, embed);
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
    /** @type {null|string} */
    let emote = null;
    await this.bot.sql.transaction(async query => {
        let result = (await query(`SELECT * FROM emotes_game
                                   WHERE guild_id = '${m.guild.id}' AND game = '${mapQueryData.game}'`)).results[0];
        if(result) emote = result.emote;
    }).catch(logger.error);

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
        field.value += Bot.Util.String.fixedWidth(KCUtil.getFormattedTimeFromFrames(entry.time), 9, ' ') + ' ';
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
            field.value = `${map.title} __by ${map.author}__\n\n` + field.value;
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
    /** @type {null|string} */
    let emote = null;
    await this.bot.sql.transaction(async query => {
        let result = (await query(`SELECT * FROM emotes_game
                                   WHERE guild_id = '${m.guild.id}' AND game = '${game}'`)).results[0];
        if(result) emote = result.emote;
    }).catch(logger.error);

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

    for(const map of maps) {
        embed.description += `**Map #${map.id}** - [${map.title}](https://knucklecracker.com/forums/index.php?topic=${map.forumId}) __by ${map.author}__\n`;
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
        if(game === 'cw2')
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
        str += `Height: ${mapData.height}`;
    else
        str += `Size: ${mapData.width}x${mapData.height}`;

    //CW4 version
    if(mapData.version != null) {
        str += `, Ver: ${mapData.version}`;
    }
    str += '\n';

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
    else
        str += `Rating: **${mapData.rating}** (${mapData.ratings} ratings)`;
    str += '\n';

    //Tags
    if(mapData.tags) {
        str += `Tags: ${mapData.tags.join(', ')}\n`;
    }
    
    //Forum link
    str += `[Forum Thread ${forumMessagesCount != null ? `(${forumMessagesCount} comment${forumMessagesCount != 1 ? 's':''})` : ''}](https://knucklecracker.com/forums/index.php?topic=${mapData.forumId})\n`;

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
 * @param {Bot.Message} m
 * @param {Discord.Message} message
 * @param {Discord.MessageEmbed} embed
 */
function userDeletionHandler(m, message, embed) {
    const collector = message.createReactionCollector({
        time: 1000 * 60 * 1,
    })

    collector.on('collect', async (reaction, user) => {
        //do not remove if bot
        if(message.member && user.id === message.member.id) return;
        await reaction.users.remove(user);

        if(user.id === m.member.id || Bot.Util.isMemberModerator(m.member) || Bot.Util.isMemberAdmin(m.member)) {
            switch(reaction.emoji.name) {
            case '❌':
                message.delete().catch(logger.error);
                break;
            }
        }
    });

    collector.on('end', async () => {
        if(!message.deleted)
            await message.reactions.removeAll();
    });

    message.react('❌').catch(logger.error);
}