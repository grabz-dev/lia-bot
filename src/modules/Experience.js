'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('../kc/KCGameMapManager.js').KCGameMapManager} KCGameMapManager */

/**
 * @typedef {object} Experience.ExpData
 * @property {number} currentXP
 * @property {number} maxXP
 * @property {number} currentLevel
 */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';

export default class Experience extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        //https://knucklecracker.com/creeperworld4/plqueryDEMO.php?gameUID=demobonus4
        //KCGameMapManager.getScoreQueryURL
        this.games = ['pf', 'cw3', 'cw2'];
        this.expBarLength = 15;
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
    * Module Function: Show info about the experience system.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call
    * @param {KCGameMapManager} ext.kcgmm 
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    info(m, args, arg, ext) {
        if(this.games.includes(KCLocaleManager.getPrimaryAliasFromAlias('game', arg)||'')) {
            return this.get(m, args, arg, ext);
        }
        else if(arg.length > 0) return;

        const embed = getEmbedTemplate();

        embed.title = this.bot.locale.category('experience', 'intro_name');
        embed.description = this.bot.locale.category('experience', 'intro_value');

        m.channel.send({ embed: embed }).catch(logger.error);
    }

    /**
    * Module Function: Wipe a user's experience data for a specific game.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    wipe(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        let argSnowflake = args[1];
        if(argSnowflake == null)
            return this.bot.locale.category('experience', 'err_user_mention_not_provided');

        let snowflake = Bot.Util.getSnowflakeFromDiscordPing(argSnowflake);
        if(snowflake == null) {
            return this.bot.locale.category('experience', 'err_user_mention_not_correct');
        }

        this.bot.tdb.session(m.guild, 'experience', async session => {
            await this.bot.tdb.remove(session, m.guild, 'experience', 'data', { }, { g: game, u: snowflake });
            m.channel.send(this.bot.locale.category('experience', 'wipe_successful')).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Register the user for the experience system.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    register(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        while(arg[0] === ' ')
            arg = arg.substring(1);
        if(arg.indexOf(' ') < 0)
            return this.bot.locale.category('experience', 'err_leaderboard_name_not_provided');
        
        arg = arg.substring(arg.indexOf(' ') + 1);

        let name = arg;

        this.bot.tdb.session(m.guild, 'experience', async session => {
            var docUserRegistry = await this.bot.tdb.findOne(session, m.guild, 'experience', 'data', { }, { g: game, u: m.member.id, n: name }, { n: 1 });
            if(docUserRegistry != null) {
                m.message.reply(this.bot.locale.category('experience', 'already_registered_with_this_name', docUserRegistry.n, KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }
            var docUserRegistry = await this.bot.tdb.findOne(session, m.guild, 'experience', 'data', { }, { g: game, n: name }, { n: 1 });
            if(docUserRegistry != null) {
                m.message.reply(this.bot.locale.category('experience', 'name_taken', docUserRegistry.n, KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }
            var docUserRegistry = await this.bot.tdb.findOne(session, m.guild, 'experience', 'data', { }, { g: game, u: m.member.id }, { n: 1 });
            if(docUserRegistry != null) {
                m.message.reply(this.bot.locale.category('experience', 'already_registered_with_other_name', docUserRegistry.n, KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            if(this.cache.get(m.guild.id, 'pendingRegistration.' + m.guild.id) === name) {
                await this.bot.tdb.insert(session, m.guild, 'experience', 'data', { }, {
                    g: game,
                    u: m.member.id,
                    n: name,
                    cc: {
                        cur: [],
                        fin: []
                    }
                });
                m.message.reply(this.bot.locale.category('experience', 'register_success', name, KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown', game)).catch(logger.error);
            }
            else {
                this.cache.set(m.guild.id, 'pendingRegistration.' + m.guild.id, name);
                m.message.reply(this.bot.locale.category('experience', 'register_confirm', name, KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
            }
        }).catch(logger.error);
    }

    /**
    * Module Function: Show the experience leaderboards.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {any} ext - Custom parameters provided to function call.
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    leaderboard(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        this.bot.tdb.session(m.guild, 'experience', async session => {
            let documents = await this.bot.tdb.find(session, m.guild, 'experience', 'data', { }, { g: game }, { });
            if(documents.length === 0) {
                m.channel.send(this.bot.locale.category('experience', 'leaderboard_empty')).catch(logger.error);
                return;
            }
            documents.sort((a, b) => {
                return b.cc.fin.length - a.cc.fin.length
            });
            let docThisUser = await this.bot.tdb.findOne(session, m.guild, 'experience', 'data', { }, { g: game, u: m.member.id }, { });
            
            let emote = ':game_die:';
            await this.bot.tdb.session(m.guild, 'emotes', async session => {
                let documents = await this.bot.tdb.find(session, m.guild, 'emotes', 'game', { }, {_id: game}, {e: 1});
                let e = documents.find(v => v._id === game);
                if(e) emote = e.e;
            }).catch(logger.error);

            let msgStr = emote + ' ' + this.bot.locale.category('experience', 'leaderboard_title', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown') + '\n\n';

            let selfFound = false;
            for(let i = 0; i < Math.min(10, documents.length); i++) {
                let document = documents[i];

                switch(i) {
                    case 0: msgStr += ':first_place: '; break;
                    case 1: msgStr += ':second_place: '; break;
                    case 2: msgStr += ':third_place: '; break;
                    case 3: msgStr += ':chocolate_bar: '; break;
                    default: msgStr += ':small_blue_diamond: ';
                }

                let expData = getExpDataFromMapsBeaten(document.cc.fin.length);
                msgStr += (i + 1) < 10 ? '  ' : '';
                msgStr += '`#' + (i + 1) + '` - ';
                msgStr += getFormattedXPBarString('', expData, this.expBarLength);
                msgStr += ' - <@' + document.u + '>\n';

                if(docThisUser && document.u === docThisUser.u)
                    selfFound = true;
            }

            if(docThisUser && !selfFound) {
                msgStr += '\n:small_blue_diamond: ';

                let expData = getExpDataFromMapsBeaten(docThisUser.cc.fin.length);
                msgStr += '`#' + (documents.findIndex(v => v.u === docThisUser.u) + 1) + '` - ';
                msgStr += getFormattedXPBarString('', expData, this.expBarLength);
                msgStr += ' - <@' + docThisUser.u + '>\n';
            }

            m.channel.send('...').then(message => {
                message.edit(msgStr).catch(logger.error);
            }).catch(logger.error);
        });
    }

    /**
    * Module Function: Show the user's experience breakdown for each game.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call
    * @param {KCGameMapManager} ext.kcgmm 
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    exp(m, args, arg, ext) {
        const kcgmm = ext.kcgmm;

        let embed = getEmbedTemplate(m.member);

        /** @type {Object.<string, number>} */
        let projection = {};
        for(let i = 0; i < this.games.length; i++)
            projection['game.' + this.games[i] + '.user.' + m.member.id] = 1;

        this.bot.tdb.session(m.guild, 'experience', async session => {
            embed.fields = [];

            /** @type {any} */
            let emotes = {};
            await this.bot.tdb.session(m.guild, 'emotes', async session => {
                let documents = await this.bot.tdb.find(session, m.guild, 'emotes', 'game', { }, { }, {e: 1});
                emotes = documents.reduce((a, v) => { a[v._id] = v.e; return a; }, {});
            }).catch(logger.error);

            for(let game of this.games) {
                var document = await this.bot.tdb.findOne(session, m.guild, 'experience', 'data', { }, { g: game, u: m.member.id }, { });
                let expData = getExpDataFromMapsBeaten(document ? document.cc.fin.length : 0);

                let field = {
                    name: getFormattedXPBarString(emotes[game]||':game_die:', expData, this.expBarLength),
                    value: '...',
                    inline: false,
                }

                if(document == null) {
                    field.value = Bot.Util.getSpecialWhitespace(3);
                    field.value += this.bot.locale.category('experience', 'embed_not_registered_1', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown');
                    field.value = Bot.Util.getSpecialWhitespace(3);
                    field.value += this.bot.locale.category('experience', 'embed_not_registered_2', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown');
                }
                else {
                    let finished = [];
                    let unfinished = [];
                    let completed = [];
                    for(let id of document.cc.cur)
                        completed.push(kcgmm.getMapCompleted({game: game, type: 'custom', id: id}, document.n));
                    for(let i = 0; i < completed.length; i++) {
                        completed[i] = await completed[i];
                        completed[i] ? finished.push(document.cc.cur[i]) : unfinished.push(document.cc.cur[i]);
                    }

                    let str = '';
                    str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_1');
                    for(let j = 0; j < unfinished.length; j++)
                        str += '`#' + unfinished[j] + '` ';
                    str += '\n';

                    str += Bot.Util.getSpecialWhitespace(3) + this.bot.locale.category('experience', 'embed_maps_2');            
                    for(let j = 0; j < finished.length; j++)
                        str += '`#' + finished[j] + '` ';

                    field.value = str;
                    field.name += ' ' + document.n;
                }

                embed.fields.push(field);
            }

            embed.fields[embed.fields.length - 1].value += '\n' + Bot.Util.getSpecialWhitespace(1);

            embed.fields.push({
                name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
                value: this.bot.locale.category('experience', 'embed_instructions_value'),
                inline: false,
            });

            m.channel.send({ embed:embed }).catch(logger.error);
        }).catch(logger.error);
    }

    /**
    * Module Function: Award experience for completed maps and generate new maps to complete.
    * @param {Bot.Message} m - Message of the user executing the command.
    * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
    * @param {string} arg - The full string written by the user after the command.
    * @param {object} ext - Custom parameters provided to function call
    * @param {KCGameMapManager} ext.kcgmm 
    * @returns {string | void} undefined if finished correctly, string if an error is thrown.
    */
    get(m, args, arg, ext) {
        let game = args[0];
        if(game == null)
            return this.bot.locale.category('experience', 'err_game_name_not_provided');

        game = KCLocaleManager.getPrimaryAliasFromAlias('game', game) || '';
        if(game.length === 0 || !this.games.includes(game))
            return this.bot.locale.category('experience', 'err_game_name_not_supported', args[0]);

        let guild = m.guild;
        let member = m.member;
        const kcgmm = ext.kcgmm;

        this.bot.tdb.session(guild, 'experience', async session => {
            let emote = ':game_die:';
            await this.bot.tdb.session(guild, 'emotes', async session => {
                let documents = await this.bot.tdb.find(session, guild, 'emotes', 'game', { }, {_id: game}, {e: 1});
                let e = documents.find(v => v._id === game);
                if(e) emote = e.e;
            }).catch(logger.error);

            let document = await this.bot.tdb.findOne(session, guild, 'experience', 'data', { }, { g: game, u: member.id }, { });
            if(document == null) {
                m.message.reply(this.bot.locale.category('experience', 'not_registered', KCLocaleManager.getPrimaryAliasFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            let expDataOld = getExpDataFromMapsBeaten(document.cc.fin.length);
            let xpOld = getFormattedXPBarString(null, expDataOld, this.expBarLength, true);

            { let promises = [];
            for(let i = 0; i < document.cc.cur.length; i++)
                promises[i] = kcgmm.getMapCompleted({game: game, type: 'custom', id: document.cc.cur[i]}, document.n);
            for(let i = 0; i < promises.length; i++) {
                promises[i] = await promises[i];
                let id = document.cc.cur[i];
                //Find which maps generated last time were completed.
                //Add them to the finished maps array.
                if(promises[i] && !document.cc.fin.includes(id)) {
                    document.cc.fin.push(document.cc.cur[i]);
                }
            } }
            
            //Sort finished maps.
            document.cc.fin.sort(/** @param {number} a * @param {number} b */ function(a, b){ return a - b });

            //Get the array of every map in the game. Removed maps do not exist in this array.
            let mapListArray = kcgmm.getMapListArray(game);
            let mapListByIds = kcgmm.getMapListByIds(game);

            if(mapListArray == null || mapListByIds == null) {
                m.channel.send(this.bot.locale.category('experience', 'map_processing_error', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown')).catch(logger.error);
                return;
            }

            //Go over all finished maps.
            //Compare each entry to all maps in the map list.
            //If any of the maps has been removed from the game, remove the ID from finished maps.
            //This way we deduct XP if a map has been removed, to prevent users racing for completion of to-be-deleted maps.
            for(let i = 0; i < document.cc.fin.length; i++) {
                let id = document.cc.fin[i];
                
                //If we finished a removed map, remove it.
                if(mapListByIds.get(id) == null) {
                    document.cc.fin.splice(i, 1);
                    i--;
                }
            }

            //Random an index from the array.
            //Save the ID of the selected map then remove the element from the array to not roll duplicates.
            let selectedIds = [];
            while(selectedIds.length < 5 && mapListArray.length > 0) {
                let index = Bot.Util.getRandomInt(1, mapListArray.length);
                let map = mapListArray[index];

                //Remove element from the array to indicate we have processed this map.
                mapListArray.splice(index, 1);

                //If the map no longer exists (for example it was deleted from the database) don't include it.
                if(!map)
                    continue;
                    
                //If we've already finished this map, don't include it.
                if(document.cc.fin.includes(map.id)) 
                    continue;
                
                selectedIds.push(map.id);
            }

            await this.bot.tdb.update(session, guild, 'experience', 'data', { upsert: true }, { g: game, u: member.id }, {
                ['cc.cur']: selectedIds,
                ['cc.fin']: document.cc.fin 
            });

            let embed = getEmbedTemplate(member);
            embed.fields = [];

            let expDataNew = getExpDataFromMapsBeaten(document.cc.fin.length);

            let finished = [];
            let unfinished = [];

            { let promises = [];
            for(let i = 0; i < selectedIds.length; i++)
                promises[i] = kcgmm.getMapCompleted({game: game, type: 'custom', id: selectedIds[i]}, document.n);
            for(let i = 0; i < promises.length; i++) {
                promises[i] = await promises[i];
                let id = selectedIds[i];
                promises[i] ? finished.push(selectedIds[i]) : unfinished.push(selectedIds[i]);
            } }
            
            let fieldXp = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_1'),
                value: Bot.Util.getSpecialWhitespace(1),
                inline: false
            }
            fieldXp.value = '```';
            fieldXp.value += xpOld + '\n';
            fieldXp.value += '↓                   ↓  ↓                   ↓\n';
            fieldXp.value += getFormattedXPBarString(null, expDataNew, this.expBarLength, true);
            fieldXp.value += '```';

            let fieldNewMaps = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_2', KCLocaleManager.getDisplayNameFromAlias('game', game) || 'unknown'),
                value: Bot.Util.getSpecialWhitespace(3),
                inline: false
            };
            for(let j = 0; j < unfinished.length; j++)
                fieldNewMaps.value += '`#' + unfinished[j] + '` ';

            let fieldBeatenMaps = {
                name: emote + ' ' + this.bot.locale.category('experience', 'embed_results_title_3'),
                value: Bot.Util.getSpecialWhitespace(1),
                inline: false,
            }
            for(let j = 0; j < finished.length; j++)
                fieldBeatenMaps.value += '`#' + finished[j] + '` ';

            let fieldInstructions = {
                name: ':information_source: ' + this.bot.locale.category('experience', 'embed_instructions_title'),
                value: this.bot.locale.category('experience', 'embed_results_value', game),
                inline: false
            }

            if(finished.length > 0)
                fieldBeatenMaps.value += '\n' + Bot.Util.getSpecialWhitespace(1)
            else
                fieldNewMaps.value += '\n' + Bot.Util.getSpecialWhitespace(1)

            embed.fields.push(fieldXp);
            embed.fields.push(fieldNewMaps);
            if(finished.length > 0)
                embed.fields.push(fieldBeatenMaps);
            embed.fields.push(fieldInstructions);

            m.channel.send({ embed:embed }).catch(logger.error);
        }).catch(logger.error);
    }
}

/**
 * 
 * @param {string | null} emote 
 * @param {Experience.ExpData} expData
 * @param {number} expBarsMax 
 * @param {boolean=} noCode 
 * @returns {string}
 */
function getFormattedXPBarString(emote, expData, expBarsMax, noCode) {
    let str = '';
    
    if(emote == null)
        str += '';
    else
        str += emote + ' ';
    if(!noCode)
        str += '`';
    str += 'LVL: ' + Bot.Util.String.fixedWidth(expData.currentLevel+'', 4, ' ', true);
    str += ' ';
    str += 'XP: ' + Bot.Util.String.fixedWidth(expData.currentXP+'', 5, ' ', false);
    str += '/' + Bot.Util.String.fixedWidth(expData.maxXP+'', 6, ' ', true);
    str += ' ';

    let expBarsToFill = Math.floor(expData.currentXP / expData.maxXP * expBarsMax);

    str += '|';
    for(let j = 0; j < expBarsToFill; j++)
    str += '#';
    for(let j = 0; j < expBarsMax - expBarsToFill; j++)
        str += ' ';
    str += '|';
    if(!noCode)
        str += '`';

    return str;
}

/**
 * 
 * @param {number} number - The number of maps beaten.
 * @returns {Experience.ExpData}
 */
function getExpDataFromMapsBeaten(number) {
    let xp = number * 100; //100 XP per map completed.
    let level = 1;
    let xpToNextLevel = 500; //500 XP to level 2.
    let xpIncreasePerLevel = 200;

    while(true) {
        if(xp - xpToNextLevel < 0)
            break;

        xp = xp - xpToNextLevel;
        level += 1;
        xpToNextLevel += xpIncreasePerLevel;
    }

    return {
        currentXP: xp,
        maxXP: xpToNextLevel,
        currentLevel: level
    }
}

/**
 * 
 * @param {Discord.GuildMember=} member 
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate(member) {
    let embed = new Discord.MessageEmbed({
        color: 5555924,
    });
    if(member) {
        embed.author = {
            name: member.user.username + '#' + member.user.discriminator,
            iconURL: member.user.avatarURL() || member.user.defaultAvatarURL
        }
    }
    return embed;
}