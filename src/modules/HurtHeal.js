'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

import Diacritics from 'diacritics';

/**
 * @typedef {object} Db.hurtheal_setup
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {Discord.Snowflake=} last_message_id
 * @property {Discord.Snowflake=} last_channel_id
 */

/**
 * @typedef {object} Db.hurtheal_games
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {number} timestamp
 * @property {boolean} finished
 * @property {string} theme
 */

/**
 * @typedef {object} Db.hurtheal_things
 * @property {number} id - Primary key
 * @property {number} id_hurtheal_games
 * @property {string} name
 * @property {number} health_cur
 * @property {number} health_max
 * @property {number=} death_order
 */

/**
 * @typedef {object} Db.hurtheal_actions
 * @property {number} id - Primary key
 * @property {number} id_hurtheal_games
 * @property {number} id_hurtheal_things
 * @property {number} timestamp
 * @property {Discord.Snowflake} user_id
 * @property {'hurt'|'heal'} action
 * @property {string} reason
 */

/** @typedef {Db.hurtheal_things & {orderId: number}} Item */


export default class HurtHeal extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS hurtheal_setup (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                last_message_id VARCHAR(64),
                last_channel_id VARCHAR(64)
             )`);

            await query(`CREATE TABLE IF NOT EXISTS hurtheal_games (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                timestamp BIGINT NOT NULL,
                finished BOOL NOT NULL,
                theme VARCHAR(512)
             )`);

            await query(`CREATE TABLE IF NOT EXISTS hurtheal_things (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_hurtheal_games INT UNSIGNED NOT NULL,
                name VARCHAR(32) NOT NULL,
                health_cur TINYINT NOT NULL,
                health_max TINYINT NOT NULL,
                death_order TINYINT
             )`);

            await query(`CREATE TABLE IF NOT EXISTS hurtheal_actions (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_hurtheal_games INT UNSIGNED NOT NULL,
                id_hurtheal_things INT UNSIGNED NOT NULL,
                timestamp BIGINT NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                action VARCHAR(16) NOT NULL,
                reason VARCHAR(256)
             )`);
        }).catch(logger.error);

        this.barLength = 10;
        this.dictionary = {
            'hurt': 'hurt',
            'heal': 'healed'
        }
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * Module Function
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext
     * @param {'hurt'|'heal'|'start'|'help'|'show'|'theme'|'end'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'start': {
            let error = `Arguments error found at **%0**: %1. Make sure arguments are in the correct order.`;
            arg = arg.replace(/\s\s+/g, ' '); //Reduce all multi spaces, newlines etc. to single space
            let argsThings = arg.split(',');

            if(arg.length === 0) return 'Must provide some arguments';

            /** @type {Object.<string, boolean>} */
            let indexer = {}
            /** @type {{name: string, health: number}[]} */
            let things = [];

            let health = 10;

            for(let i = 0; i < argsThings.length; i++) {
                let thing = argsThings[i];

                //Trim argument
                thing = thing.trim();
                //Turn all multi spaces, tabs and newlines into a single space
                thing = thing.replace(/\s\s+/g, ' ');

                //Determine health
                if(i === 0) {
                    health = Math.ceil(+thing);
                    if(health < 1)               return error.replace('%0', `health`).replace('%1', 'Health must be 1 or more');
                    if(!Number.isFinite(health)) return error.replace('%0', `health`).replace('%1', 'Health is not a valid number');
                }
                //Determine item
                else {
                    let name = thing;
                    if(name.length <= 0)         return error.replace('%0', `item ${i}`).replace('%1', 'Name is empty');
                    if(indexer[name] == null)
                        things.push({name: name, health: health});
                    indexer[name] = true;
                }
            }

            start.call(this, m, things);
            break;
        }
        case 'show':
        case 'hurt':
        case 'heal': {
            action.call(this, m, ext.action, args, arg);    
            break;
        }
        case 'help': {
            help.call(this, m);
            break;
        }
        case 'theme': {
            let str = arg;
            theme.call(this, m, str);
            break;
        }
        case 'end': {
            end.call(this, m);
            break;
        }
        }
    }
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function help(m) {
    let embed = new Discord.MessageEmbed({
        color: 14211288,
        title: 'Hurt or Heal',
        description: `Rules:\n  • Each item is assigned an amount of score at the start.\n  • Each player can either hurt an item by removing 2 points from the item's score, or can heal an item by adding 1 point to the item's score.\n  • A player cannot play again until two other players have performed an action.\n  • Feel free to add a comment to the end of each command to indicate why you chose to hurt or heal a specific item. In fact, many people may find it interesting.`
    });
    embed.fields = [];
    embed.fields.push({
        name: ':information_source: Instructions',
        value: '`!hh` to view current standings\n`!hh hurt <item>` to hurt an item for 2 points\n`!hh heal <item>` to heal an item for 1 point',
        inline: false
    });

    m.channel.send({ embed: embed }).then(message => {
        message.delete({ timeout: 1000 * 120 }).catch(logger.error);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {string} str
 */
function theme(m, str) {
    this.bot.sql.transaction(async query => {
        await query(`UPDATE hurtheal_games SET theme = ? WHERE finished = FALSE`, [str]);

        m.message.reply('Theme set.').catch(logger.error);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function end(m) {
    this.bot.sql.transaction(async query => {
        await query(`UPDATE hurtheal_games SET finished = TRUE`);

        m.message.reply('Previous game ended.').catch(logger.error);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {{name: string, health: number}[]} things
 */
function start(m, things) {
    this.bot.sql.transaction(async (query, mysql) => {
        let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE`)).results[0];
        if(resultGames != null) {
            m.message.reply('A game is already running, to force finish it use `!hh end`').catch(logger.error);
            return;
        }

        /** @type {number} */
        let insertId = (await query(`INSERT INTO hurtheal_games (guild_id, timestamp, finished) VALUES (?, ?, FALSE)`, [m.guild.id, Date.now()])).results.insertId;

        for(let thing of things) {
            await query(`INSERT INTO hurtheal_things (id_hurtheal_games, name, health_cur, health_max) VALUES (?, ?, ?, ?)`, [insertId, thing.name, thing.health, thing.health]);
        }

        /** @type {Db.hurtheal_things[]} */
        let resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ? ORDER BY id ASC`, [insertId])).results;
        let items = getItemsFromDb(resultsThings);

        m.message.reply('New game started!', { embed: getGameStandingsEmbed.call(this, m, 'current', items) }).catch(logger.error);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'hurt'|'heal'|'show'} type
 * @param {string[]} args
 * @param {string} arg
 */
function action(m, type, args, arg) {
    this.bot.sql.transaction(async (query, mysql) => {
        /** @type {Db.hurtheal_games=} */ let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE`)).results[0];
        /** @type {'current'|'last'} */ let mode = 'current';

        if(resultGames == null) {
            resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = TRUE ORDER BY id DESC LIMIT 0, 1`)).results[0];
            mode = 'last';
        }

        if(resultGames == null) {
            m.message.reply('No game is running and no prior game was ever recorded.').catch(logger.error);
            return;
        }

        //Checks passed

        /** @type {Db.hurtheal_things[]} */
        let resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ? ORDER BY id ASC`, [resultGames.id])).results;
        let items = getItemsFromDb(resultsThings);
        /** @type {Db.hurtheal_actions[]} */
        let resultsActions = (await query(`SELECT * FROM hurtheal_actions WHERE id_hurtheal_games = ? ORDER BY id DESC LIMIT 0, 2`, [resultGames.id])).results;

        //Sort results for exit commands
        sortThings(items);

        if(type === 'show') {
            await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, '', resultGames, resultsActions));
            return;
        }

        if(resultsActions.find((v => v.user_id === m.member.id))) {
            await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, 'You have already played within the last 2 actions! Please wait your turn.', resultGames, resultsActions));
            return;
        }

        if(args.length === 0) {
            await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, `You must choose an item to ${type}.\nExample: \`!hh ${type} thing\``, resultGames, resultsActions));
            return;
        }

        if(mode === 'last') {
            await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, 'A game is not currently running.', resultGames, resultsActions));
            return;
        }

        /** @type {Item[]} */
        let itemsAlive = [];
        for(let item of items)
            if(item.health_cur > 0) itemsAlive.push(item);

        
        let reason = arg;
        /** @type {Item=} */ let currentItem;

        //Search for ID first
        if(args.length > 0) {
            let id = args[0];
            currentItem = items.find(v => `${v.orderId}` === id || `#${v.orderId}` === id);

            //If an item is found, cut ID from reason string
            if(currentItem)
                reason = reason.substring(reason.indexOf(id) + id.length);
        }

        //If an item is not found, start over, search for name and cut reason string appropriately as well
        if(currentItem == null) {
            let assembledName = '';
            //Example args: ['apple', 'pie,', 'because', 'i', 'love', 'pies']
            loop:
            for(let i = 0; i < args.length; i++) {
                //Turn 'pie,' into ['pie', ''];
                let commaSeparatedArgs = args[i].split(',');
                for(let j = 0; j < commaSeparatedArgs.length; j++) {
                    let nameFragment = commaSeparatedArgs[j];
                    if(nameFragment.length === 0) continue;

                    assembledName += ` ${nameFragment}`;
                    currentItem = items.find(v => simplifyForTest(v.name) === simplifyForTest(assembledName));
                    reason = reason.substring(reason.indexOf(nameFragment) + nameFragment.length);

                    if(currentItem != null) break loop;
                }
            }
        }
        
        //If an item is still not found, error
        if(currentItem == null) {
            await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, `Could not determine selection from input.\nMake sure to type the item ID or the full name of the item you want to hurt or heal.`, resultGames, resultsActions));
            return;
        }
        if(currentItem.health_cur <= 0) {
            await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, `**${currentItem.name}** is out of the game. You can only select from: **${itemsAlive.map((v => v.name)).join(', ')}**`, resultGames, resultsActions));
            return;
        }
        if(type === 'heal' && currentItem.health_cur >= currentItem.health_max) {
            await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, `**${currentItem.name}** is already at max health.`, resultGames, resultsActions));
            return;
        }

        //Modify current thing
        switch(type) {
        case 'heal': { currentItem.health_cur += 1; break; }
        case 'hurt': { currentItem.health_cur -= 2; break; }
        }

        //Decide if game is over
        let isGameOver = false;
        if(currentItem.health_cur <= 0) itemsAlive.splice(itemsAlive.indexOf(currentItem), 1);
        if(itemsAlive.length <= 1) {
            await query(`UPDATE hurtheal_games SET finished = TRUE WHERE id = ?`, [resultGames.id]);
            isGameOver = true;
        }

        //Give out placement
        if(currentItem.health_cur <= 0)
            currentItem.death_order = items.filter((v => v.health_cur <= 0)).length;
        if(isGameOver) {
            let winnerThing = items.find((v => v.health_cur > 0));
            if(winnerThing) {
                winnerThing.death_order = items.length;
                await query(`UPDATE hurtheal_things SET death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [winnerThing.death_order, resultGames.id, winnerThing.id]);
            }
        }

        //Update database
        await query(`UPDATE hurtheal_things SET health_cur = ?, death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [currentItem.health_cur, currentItem.death_order, resultGames.id, currentItem.id]);
        await query(`INSERT INTO hurtheal_actions (id_hurtheal_games, id_hurtheal_things, timestamp, user_id, action, reason) VALUES (?, ?, ?, ?, ?, ?)`, [resultGames.id, currentItem.id, Date.now(), m.member.id, type, reason]);

        //Refresh actions
        /** @type {Db.hurtheal_actions[]} */
        resultsActions = (await query(`SELECT * FROM hurtheal_actions WHERE id_hurtheal_games = ? ORDER BY id DESC LIMIT 0, 2`, [resultGames.id])).results;

        //Sort things again for final message after changes
        sortThings(items);

        //Send final message
        await sendNewGameMessage(m, query, getGameStandingsEmbed.call(this, m, mode, items, `**${currentItem.name}** was ${this.dictionary[type]} and is now at **${Math.max(0, currentItem.health_cur)}** health.${isGameOver ? `\n**The game is over!**`:''}`, resultGames, resultsActions, type), isGameOver ? true : false);
    }).catch(logger.error);
}

/**
 * @param {Bot.Message} m
 * @param {SQLWrapper.Query} query 
 * @param {Discord.MessageEmbed} embed
 * @param {boolean=} noRegister - Don't register this message as one that should be deleted later
 */
async function sendNewGameMessage(m, query, embed, noRegister) {
    const message = await m.channel.send({ embed: embed });

    /** @type {Db.hurtheal_setup=} */
    let resultSetup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ?`, [m.guild.id])).results[0];

    if(resultSetup != null) {
        if(resultSetup.last_channel_id && resultSetup.last_message_id) {
            let channel = m.guild.channels.resolve(resultSetup.last_channel_id);
            if(channel instanceof Discord.TextChannel) {
                let message = await channel.messages.fetch(resultSetup.last_message_id).catch(() => {});
                if(message) message.delete().catch(logger.error);
            }
        }
    }

    if(noRegister)
        return;

    if(resultSetup == null)
        await query(`INSERT INTO hurtheal_setup (guild_id, last_message_id, last_channel_id) VALUES (?, ?, ?)`, [m.guild.id, message.id, message.channel.id]);
    else 
        await query(`UPDATE hurtheal_setup SET last_message_id = ?, last_channel_id = ? WHERE guild_id = ?`, [message.id, message.channel.id, m.guild.id]);
}


/**
 * @this {HurtHeal}
 * @param {Bot.Message} m
 * @param {'current'|'last'} mode
 * @param {Item[]} things
 * @param {string=} str
 * @param {Db.hurtheal_games=} game
 * @param {(Db.hurtheal_actions[])=} actions
 * @param {('hurt'|'heal')=} action
 * @returns {Discord.MessageEmbed}
 */
function getGameStandingsEmbed(m, mode, things, str, game, actions, action) {
    var embed = new Discord.MessageEmbed({
        color: 14211288,
        author: {
            name: '🎮 Hurt or Heal',
        },
        timestamp: Date.now(),
        footer: {
            text: '`!hh help` for help'
        }
    });
    if(action == 'hurt') embed.color = 16731994;
    else if(action == 'heal') embed.color = 6214143;

    embed.description = '';
    if(str != null && str.length > 0) embed.description += `<@${m.member.id}>, ${str}\n\n`;

    embed.description += `${mode === 'current' ? '' : 'Last game\'s results:\n'}`;
    if(game && game.theme) {
        embed.description += `Theme: **${game.theme}**\n`;
    }

    let space = things.length >= 10 ? ' ' : '';

    embed.fields = [];
    for(let thing of things) {
        embed.description += `\`${getHealthBar.call(this, thing)}\`  \`${space && thing.orderId < 10 ? ' ':''}#${thing.orderId}\` **${thing.name}** ${getThingPlace(thing, things)}\n`;
    }

    if(actions) {
        let fieldActions = { name: 'Last two actions', value: '', inline: false }
        for(let action of actions) {
            let thing = things.find((v => v.id === action.id_hurtheal_things))
            fieldActions.value += `<@${action.user_id}> ${this.dictionary[action.action]} ${thing ? `**${thing.name}**` : 'unknown'} ${action.reason ? action.reason : ''}\n`;
        }
        if(fieldActions.value.length > 0) embed.fields.push(fieldActions);
    }

    return embed;
}

/**
 * @this {HurtHeal}
 * @param {Db.hurtheal_things} thing
 * @returns {string}
 */
function getHealthBar(thing) {
    let str = '';
    let health = thing.health_cur <= 0 ? 0 : thing.health_cur;
    let overheals = 10;

    let bars = [];
    for(let i = 0; i < overheals; i++) {
        bars[i] = thing.health_cur - thing.health_max * i;
    }

    for(let i = 0; i < this.barLength; i++) {
        let type = -1;
        for(let j = overheals - 1; j >= 0; j--) {
            if(i < Math.ceil(bars[j] / thing.health_max * this.barLength)) {
                type = j;
                break;
            }
        }

        switch(type) {
        case 9: str += '^'; break;
        case 8: str += 'W'; break;
        case 7: str += 'O'; break;
        case 6: str += 'P'; break;
        case 5: str += '@'; break;
        case 4: str += '€'; break;
        case 3: str += '&'; break;
        case 2: str += '%'; break;
        case 1: str += '$'; break;
        case 0: str += '#'; break;
        default: str += ' '; break;
        }
    }

    return `${health < 10 ? ' ':''}${health}|${str}|`;
}

/**
 * 
 * @param {Db.hurtheal_things} thing
 * @param {Db.hurtheal_things[]} things
 * @returns {string}
 */
function getThingPlace(thing, things) {
    if(thing.death_order == null) return '';
    const place = things.length - thing.death_order + 1;
    switch(place) {
    case 1: return ':first_place:';
    case 2: return ':second_place:';
    case 3: return ':third_place:';
    default: return Bot.Util.getNumberWithOrdinal(place);
    }
}

/**
 * 
 * @param {Item[]} things 
 */
function sortThings(things) {
    things.sort((a, b) => {
        let defeat = (b.death_order??0) - (a.death_order??0);
        //let alphabetic = a.name.localeCompare(b.name);
        let ordered = (a.orderId - b.orderId);

        if(defeat !== 0) {
            let health = Math.max(0, b.health_cur) - Math.max(0, a.health_cur);
            return health || defeat;
        }
        else return ordered;
        //else return alphabetic;
    });
}

/**
 * 
 * @param {string} str 
 * @returns {string} 
 */
function simplifyForTest(str) {
    return Diacritics.remove(str).replace(/\s+/g, '').toLowerCase();
}

/**
 * Assign things with orderId that lets players choose an item by number
 * This function assumes that `things` is already ordered by database ID
 * @param {Db.hurtheal_things[]} things 
 */
function getItemsFromDb(things) {
    //
    let i = 0;
    return things.map(v => {
        i++;
        return Object.assign({ orderId: i }, v);
    });
}