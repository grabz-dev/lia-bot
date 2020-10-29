'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/Core')} Message */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */
/** @typedef {import('../kc/KCGameMapManager.js').MapData} KCGameMapManager.MapData */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

export default class Map extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.games = ['cw2', 'cw3', 'pf', 'cw4'];
    }

    /**
    * Module Function: Post map information of a specified custom map.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call.
    * @param {KCGameMapManager} ext.kcgmm
    * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
    */
    get(m, args, arg, ext) {
        const kcgmm = ext.kcgmm;

        let game = args[0];
        let mapId = args[1];

        //If game parameter is not provided, choose a random game.
        if(game == null) {
            game = this.games[Bot.Util.getRandomInt(0, this.games.length)];
        }

        //If the provided argument is not a Knuckle Cracker game.
        let def = KCLocaleManager.getPrimaryAliasFromAlias('game', game);
        if(def == null)
            return this.bot.locale.category('mapdata', 'err_game_not_correct');
        game = def;

        //If the provided Knuckle Cracker game is not supported.
        let mapListByIds = kcgmm.getMapListByIds(game);
        if(mapListByIds == null)
            return this.bot.locale.category('mapdata', 'err_game_not_supported', KCLocaleManager.getDisplayNameFromAlias('game', game) + '');

        //If the ID is not provided or provided 'random', get a random map.
        if(mapId == null || mapId == 'random')
            mapId = (mapListByIds.random().id || 1) + '';

        let id = Number(mapId);
        if(id < 0)
            return this.bot.locale.category('mapdata', 'err_mapid_negative');
        if(!Number.isFinite(id) || id <= 0)
            return this.bot.locale.category('mapdata', 'err_mapid_invalid');

        const guild = m.guild;

        (async () => {
            let emote = ':game_die:';
            await this.bot.tdb.session(guild, 'emotes', async session => {
                let documents = await this.bot.tdb.find(session, guild, 'emotes', 'game', { }, {_id: game}, {e: 1});
                let e = documents.find(v => v._id === game);
                if(e) emote = e.e;
            }).catch(logger.error);

            let mapList = kcgmm.getMapListByIds(game);
            if(mapList != null) {
                let mapData = mapList.get(id);
                if(mapData) {
                    m.channel.send({ embed:getMapMessageEmbed.bind(this)(mapData, emote, guild, game) }).catch(logger.error);
                    return;
                }
            }

            var str = this.bot.locale.category('mapdata', 'searching_map');
            if(game === 'cw2') str += '\n\n' + this.bot.locale.category('mapdata', 'searching_map_cw2_add');
            m.channel.send(str).then(message => {
                (async () => {
                    if(game !== 'cw2')
                        await kcgmm.fetch(game);
        
                    mapList = kcgmm.getMapListByIds(game);
                    if(!mapList) {
                        message.edit(this.bot.locale.category('mapdata', 'search_result_not_found')).catch(logger.error);
                        return;
                    }
                    let mapData = mapList.get(id);
                    if(!mapData)
                        message.edit(this.bot.locale.category('mapdata', 'search_result_not_found')).catch(logger.error);
                    else
                        message.edit('', {
                            embed: getMapMessageEmbed.bind(this)(mapData, emote, guild, game)
                        }).catch(logger.error);
                })().catch(e => {
                    logger.info(e);
                    message.edit(this.bot.locale.category('mapdata', 'search_result_too_fast')).catch(logger.error);
                });
            }).catch(logger.error);
        })().catch(logger.error);
    }

    /**
    * Module Function: Post score information of a specified map.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call.
    * @param {KCGameMapManager} ext.kcgmm
    * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
    */
    score(m, args, arg, ext) {
        const kcgmm = ext.kcgmm;

        const _data = ext.kcgmm.getMapQueryObjectFromCommandParameters(args);
        if(_data.err) return _data.err;
        const mapQueryData = _data.data;

        (async () => {
            let emote = null;
            await this.bot.tdb.session(m.guild, 'emotes', async session => {
                let documents = await this.bot.tdb.find(session, m.guild, 'emotes', 'game', { }, {_id: mapQueryData.game}, {e: 1});
                let e = documents.find(v => v._id === mapQueryData.game);
                if(e) emote = e.e;
            }).catch(logger.error);

            let embed = getEmbedTemplate.bind(this)(mapQueryData.game, m.guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''));
            embed.fields = [];
            var field = {
                name: `${KCLocaleManager.getDisplayNameFromAlias('map_mode_custom', `${mapQueryData.game}_${mapQueryData.type}`)} Map`,
                value: '',
                inline: false,
            }

            if(mapQueryData.id)
                field.name += `: #${mapQueryData.id}`;
            else if(mapQueryData.type === 'code')
                field.name += `: \`${mapQueryData.name}\` S:${mapQueryData.size} C:${mapQueryData.complexity}`;

            let entries = 15;
            let leaderboard = await kcgmm.getMapScores(mapQueryData);
            let longest = 0;
            for(let i = 0; i < Math.min(15, leaderboard.entries.length); i++) {
                const entry = leaderboard.entries[i];
                if(entry.user.length > longest) longest = entry.user.length;
            }

            for(let i = 0; i < Math.min(15, leaderboard.entries.length); i++) {
                const entry = leaderboard.entries[i];
                if(i > 0) field.value += '\n';
                field.value += Bot.Util.String.fixedWidth(`#${entry.rank}`, 3, ' ') + ' ';
                field.value += Bot.Util.String.fixedWidth(KCUtil.getFormattedTimeFromFrames(entry.time), 9, ' ') + ' ';
                field.value += Bot.Util.String.fixedWidth(entry.user, longest, ' ', true);
            }
            field.value = '```\n' + Bot.Util.String.fixedWidth('', longest + 18, ' ') + '\n' + field.value;
            field.value += '\n```';
            embed.fields[0] = field;
            m.channel.send({ embed: embed }).catch(logger.error);
        })().catch(logger.error);
    }
}

/**
 * @this Map
 * @param {KCGameMapManager.MapData} mapData 
 * @param {string} emoteStr 
 * @param {Discord.Guild} guild 
 * @param {string} game 
 * @returns {Discord.MessageEmbed}
 */
function getMapMessageEmbed(mapData, emoteStr, guild, game) {
    let emoteId = Bot.Util.getSnowflakeFromDiscordPing(emoteStr);
    let emote = emoteId ? guild.emojis.resolve(emoteId) : null;

    let thumbnailURL = '';
    if(mapData.id && mapData.id > 0) {
        if(game === 'cw2') {
            thumbnailURL = 'http://knucklecracker.com/creeperworld2/thumb.php?id=' + mapData.id;
        }
        else {
            thumbnailURL = 'http://knucklecracker.com/' + KCLocaleManager.getUrlStringFromPrimaryAlias(game) + '/queryMaps.php?query=thumbnailid&id=' + mapData.id;
        }
    }

    let embed = getEmbedTemplate.bind(this)(game, emote);
    embed.image = {
        url: thumbnailURL
    }

    let str = '';

    //Author
    str += `Author: **${mapData.author}**\n`;

    //Width/Height
    if(game === 'cw2')
        str += `Height: ${mapData.height}`;
    else
        str += `Size: ${mapData.width}x${mapData.height}`;
    str += '\n';

    //Scores/Downloads
    if(typeof mapData.scores === 'number')
        str += `Scores/Downloads: ${mapData.scores} : ${mapData.downloads} (${Math.round(mapData.scores / mapData.downloads * 1000) / 1000})`;
    else
        str += `Downloads: ${mapData.downloads}`;
    str += '\n';

    //Rating/Upvotes/Downvotes
    if(game === 'cw2')
        str += `Rating: **${mapData.upvotes}** :thumbsup:  **${mapData.downvotes}** :thumbsdown:`;
    else if(game === 'cw4')
        str += `Rating: **${mapData.rating}** :thumbsup:`;
    else
        str += `Rating: **${mapData.rating}** (${mapData.ratings} ratings)`;
    str += '\n';

    //Tags
    if(mapData.tags)
        str += `Tags: ${mapData.tags.join(', ')}`;
    str += '\n';

    //ID/Title
    embed.fields = [{
        name: ':map: Map #' + mapData.id + ': ' + mapData.title,
        value: str,
        inline: false
    }];
    
    //Desc
    if(mapData.desc && mapData.desc.length > 0) {
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
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate(game, emote) {
    return new Discord.MessageEmbed({
        color: KCUtil.gameEmbedColors[game],
        author: {
            name: KCLocaleManager.getDisplayNameFromAlias('game', game) || '',
            icon_url: emote ? emote.url : undefined
        },
        thumbnail: emote ? {url: emote.url} : undefined,
        fields: [],
    });
}