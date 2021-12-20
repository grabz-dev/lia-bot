'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { KCUtil } from '../kc/KCUtil.js';

import Diacritics from 'diacritics';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import chartjs from 'chart.js';
import 'chartjs-adapter-date-fns';

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 500, chartCallback: ChartJS => {
    ChartJS.defaults.color = '#CCCCCC';
    ChartJS.defaults.font.size = 15;
    ChartJS.defaults.font.family = "Helvetica Neue, Helvetica, Arial, sans-serif"
}});

const DECAY_HOURS = 12;
const ENTRIES_PER_LIST_PAGE = 10;

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
 * @property {number} last_decay_timestamp
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
 * @property {number} id_hurtheal_things
 * @property {number} timestamp
 * @property {Discord.Snowflake} user_id
 * @property {'hurt'|'heal'|'decay'} action
 * @property {string} reason
 */

/** @typedef {Db.hurtheal_things & {orderId: number}} Item */

/** @typedef {{type: 'hurt'|'heal'|'show'|'decay', args: string[], arg: string, m: Bot.Message}} QueueItem */

/**
 * 
 * @param {number} prev 
 * @param {Db.hurtheal_things} cur 
 * @returns 
 */
const highestDeathOrderThingInGame = (prev, cur) => { if(cur.death_order != null && cur.death_order > prev) return cur.death_order; return prev; };


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
                theme VARCHAR(512),
                last_decay_timestamp BIGINT NOT NULL
             )`);

            await query(`CREATE TABLE IF NOT EXISTS hurtheal_things (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_hurtheal_games INT UNSIGNED NOT NULL,
                name VARCHAR(128) NOT NULL,
                health_cur TINYINT NOT NULL,
                health_max TINYINT NOT NULL,
                death_order TINYINT
             )`);

            await query(`CREATE TABLE IF NOT EXISTS hurtheal_actions (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                id_hurtheal_things INT UNSIGNED NOT NULL,
                timestamp BIGINT NOT NULL,
                user_id VARCHAR(64) NOT NULL,
                action VARCHAR(16) NOT NULL,
                reason VARCHAR(256)
             )`);
        }).catch(logger.error);

        this.barLength = 20;
        this.lastActionsCounted = 2;
        this.lastActionsShown = 5;
        this.dictionary = {
            'hurt': 'hurt',
            'heal': 'healed',
        }
        this.chartColors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000']
        /** @type {Object.<string, string|undefined>} */
        this.colorOverrides = {
            black: 'black',
            white: 'white',
            gray: 'gray',
            silver: 'silver',
            maroon: 'maroon',
            red: 'red',
            purple: 'purple',
            fuchsia: 'fuchsia',
            green: 'green',
            lime: 'lime',
            olive: 'olive',
            yellow: 'yellow',
            navy: 'navy',
            blue: 'blue',
            teal: 'teal',
            aqua: 'aqua',
        }

        /** @type {Map<Discord.Snowflake, Discord.Message>} */
        this.noDeleteCache = new Map();

        this.KCServerDefs = {
            guildId: "192420539204239361",
            hurtHealChannelId: "903995340846407731"
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
     * @param {'hurt'|'heal'|'start'|'help'|'show'|'theme'|'end'|'chart'|'list'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        if(ext.action !== 'list') {
            if(m.guild.id === this.KCServerDefs.guildId && m.channel.id !== this.KCServerDefs.hurtHealChannelId) {
                m.channel.send(`You can only use this command in the <#${this.KCServerDefs.hurtHealChannelId}> channel.`).then(message => {
                    setTimeout(() => { message.delete(); m.message.delete(); }, 10000);
                }).catch(logger.error);
                return;
            }
        }

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
        case 'chart': {
            let id = +args[0];
            if(!Number.isFinite(id)) return 'Invalid ID number';
            chart.call(this, m, id);
            break;
        }
        case 'list': {
            list.call(this, m);
            break;
        }
        }
    }

    /** @param {Discord.Message} message - The message that was sent. */
    onMessage(message) {
        if(message.channel.id !== this.KCServerDefs.hurtHealChannelId) return;
        if(message.guild == null) return;
        if(message.guild.id !== this.KCServerDefs.guildId) return;

        ((message) => {
            this.bot.sql.transaction(async query => {
                let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE`)).results[0];
                if(resultGames == null) return;

                setTimeout(() => {
                    let cacheMessage = this.noDeleteCache.get(message.id);
                    this.noDeleteCache.delete(message.id);
                    if(cacheMessage != null) return;
                    message.delete();
                }, 5000);
            }).catch(logger.error);
        })(message);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    loop(guild) {

        this.bot.sql.transaction(async query => {
            const ms = (1000 * 60 * 60 * DECAY_HOURS);

            /** @type {Db.hurtheal_games=} */ let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE`)).results[0];
            if(resultGames == null) return;

            const now = Date.now();
            if(now - resultGames.last_decay_timestamp < ms) return;

            /** @type {Db.hurtheal_setup=} */ let resultSetup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ${guild.id}`)).results[0];
            if(resultSetup == null) return;

            //do nothing if all items are 1hp or lower
            /** @type {Db.hurtheal_things[]} */ let resultThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ?`, [resultGames.id])).results;
            if(!resultThings.some(v => v.health_cur > 1)) return;

            if(resultSetup.last_channel_id == null) return;
            const channel = await guild.channels.fetch(resultSetup.last_channel_id);
            if(!(channel instanceof Discord.TextChannel)) return;

            const message = await channel.send(DECAY_HOURS + ' hours have passed with no activity. All items take 1 damage.');
            if(message.member == null) return;

            return {message, channel}
        }).then(data => {
            if(data == null || data.message.member == null) return;
            
            action.call(this, new Bot.Message(data.message, data.message.member, guild, data.channel), 'decay', [], '');
        }).catch(logger.error);
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
        description: `Rules:\n  • Each item is assigned an amount of health at the start.\n  • Each player can either hurt an item - removing 2 health from it, or heal an item - adding 1 health to it, if it isn't at max health.\n  • A player cannot play again until two other players have performed an action.\n  • More than 2 actions cannot be performed consecutively on a single item.\n  • Feel free to add a comment to the end of each command to indicate why you chose to hurt or heal a specific item. In fact, many people may find it interesting.`
    });
    embed.fields = [];
    embed.fields.push({
        name: ':information_source: Instructions',
        value: '`!hh` to view current standings\n`!hh hurt <item> <reason?>` to hurt an item for 2 points\n`!hh heal <item> <reason?>` to heal an item for 1 point',
        inline: false
    });

    this.bot.sql.transaction(async query => {
        await handleHHMessage.call(this, query, m.message, true, { embeds: [embed] }, m.channel, false, false);
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

        await handleHHMessage.call(this, query, m.message, false, 'Theme set.', m.channel, true, false);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function end(m) {
    this.bot.sql.transaction(async query => {
        await query(`UPDATE hurtheal_games SET finished = TRUE`);

        await handleHHMessage.call(this, query, m.message, false, 'Previous game ended.', m.channel, true, false);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {{name: string, health: number}[]} things
 */
function start(m, things) {
    this.bot.sql.transaction(async (query, mysql) => {
        let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE FOR UPDATE`)).results[0];
        if(resultGames != null) {
            await handleHHMessage.call(this, query, m.message, false, 'A game is already running, to force finish it use `!hh end`', m.channel, true, false);
            return;
        }

        /** @type {number} */
        const now = Date.now();
        let insertId = (await query(`INSERT INTO hurtheal_games (guild_id, timestamp, finished, last_decay_timestamp) VALUES (?, ?, FALSE, ?)`, [m.guild.id, now, now])).results.insertId;

        for(let thing of things) {
            await query(`INSERT INTO hurtheal_things (id_hurtheal_games, name, health_cur, health_max) VALUES (?, ?, ?, ?)`, [insertId, thing.name, thing.health, thing.health]);
        }

        /** @type {Db.hurtheal_things[]} */
        let resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ? ORDER BY id ASC`, [insertId])).results;
        let items = getItemsFromDb(resultsThings);

        await handleHHMessage.call(this, query, m.message, false, { content: 'New game started!', embeds: [await getGameStandingsEmbed.call(this, m, {mode: 'current', things: items, game: insertId})] }, m.channel, true, false);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'hurt'|'heal'|'show'|'decay'} type
 * @param {string[]} args
 * @param {string} arg
 */
async function action(m, type, args, arg) {
    await this.bot.sql.transaction(async (query, mysql) => {
        const now = Date.now();

        /** @type {Db.hurtheal_games=} */ let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE FOR UPDATE`)).results[0];
        /** @type {'current'|'last'} */ let mode = 'current';

        if(resultGames == null) {
            resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = TRUE ORDER BY id DESC LIMIT 0, 1`)).results[0];
            mode = 'last';
        }

        if(resultGames == null) {
            await handleHHMessage.call(this, query, m.message, true, 'No game is running and no prior game was ever recorded.', m.channel, true, true);
            return;
        }

        //Checks passed

        /** @type {Db.hurtheal_things[]} */
        let resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ? ORDER BY id ASC`, [resultGames.id])).results;
        let items = getItemsFromDb(resultsThings);

        /**
         * @param {Db.hurtheal_games} resultGames 
         * @returns {Promise<Db.hurtheal_actions[]>}
         */
        const getActionsWithSort = async (resultGames) => (await query(`SELECT * FROM hurtheal_actions ha JOIN hurtheal_things ht ON ha.id_hurtheal_things = ht.id WHERE ht.id_hurtheal_games = ? AND ha.action != ? ORDER BY ha.id DESC`, [resultGames.id, 'decay'])).results;
        let resultsActions = await getActionsWithSort(resultGames);

        //Sort results for exit commands
        sortThings(items);

        if(type === 'show') {
            if(args.length > 0) {
                await handleHHMessage.call(this, query, m.message, true, 'Invalid command, please check for misspellings.', m.channel, true, true);
                return;
            }

            await sendNewGameMessage.call(this, m, query, type, await getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions}));
            return;
        }

        if(mode === 'last') {
            await handleHHMessage.call(this, query, m.message, true, 'A game is not currently running.', m.channel, true, true);
            return;
        }

        /*if(type != 'decay' && 
           resultsActions.length > 0 &&
           now - resultsActions[resultsActions.length - 1].timestamp < (1000 * 60 * 60 * 24) &&
           resultsActions.slice(0, this.lastActionsCounted).find((v => v.user_id === m.member.id))) {
            await handleHHMessage.call(this, query, m.message, true, `You have already played within the last ${this.lastActionsCounted} actions. Please wait your turn. If nobody plays within the next ${Bot.Util.getFormattedTimeRemaining((resultsActions[resultsActions.length - 1].timestamp + (1000 * 60 * 60 * 24)) - now)}, you'll be able to play again, too.`, m.channel, true, true);
            return;
        }*/

        /*if(resultsActions.slice(0, this.lastActionsCounted).find((v => v.user_id === m.member.id))) {
            await handleHHMessage.call(this, query, m.message, true, `You have already played within the last ${this.lastActionsCounted} actions. Please wait your turn.`, m.channel, true, true);
            return;
        }*/

        if(type != 'decay' && args.length === 0) {
            await handleHHMessage.call(this, query, m.message, true, `You must choose an item to ${type}.\nExample: \`!hh ${type} thing\``, m.channel, true, true);
            return;
        }

        /** @type {Item[]} */
        let itemsAlive = [];
        for(let item of items)
            if(item.health_cur > 0) itemsAlive.push(item);

        
        let reason = arg;
        /** @type {Item=} */ let currentItem;

        //Search for ID first
        if(type != 'decay') {
            let id = args[0].split(',')[0];
            currentItem = items.find(v => `${v.orderId}` === id || `#${v.orderId}` === id);

            //If an item is found, cut ID from reason string
            if(currentItem)
                reason = reason.substring(reason.indexOf(id) + id.length);
            //If an item is not found, start over, search for name and cut reason string appropriately as well
            else {
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
        }
        
        if(type != 'decay') {
            //If an item is still not found, error
            if(currentItem == null) {
                await handleHHMessage.call(this, query, m.message, true, `Could not determine selection from input.\nMake sure to type the item ID or the full name of the item you want to hurt or heal.`, m.channel, true, true);
                return;
            }
            if(currentItem.health_cur <= 0) {
                await handleHHMessage.call(this, query, m.message, true, `**${currentItem.name}** is out of the game. You can only select from: **${itemsAlive.map((v => v.name)).join(', ')}**`, m.channel, true, true);
                return;
            }
            /*if(itemsAlive.length > 2 &&
            resultsActions[0] && resultsActions[0].id_hurtheal_things === currentItem.id &&
            resultsActions[1] && resultsActions[1].id_hurtheal_things === currentItem.id) {
                await handleHHMessage.call(this, query, m.message, true, `An action cannot be performed on the same item more than twice in a row while more than two items are still in play. Please select a different item.`, m.channel, true, true);
                return;
            }*/
            if(type === 'heal' && currentItem.health_cur >= currentItem.health_max) {
                await handleHHMessage.call(this, query, m.message, true, `**${currentItem.name}** is already at max health.`, m.channel, true, true);
                return;
            }
            if(Discord.Util.escapeMarkdown(reason).length > 255) {
                await handleHHMessage.call(this, query, m.message, 30, `The given reason is too long. The character limit is 255 characters (formatting characters contribute to the character limit).`, m.channel, true, true);
                return;
            }

            //Modify current thing
            if(type === 'heal') currentItem.health_cur += 1;
            else if(type === 'hurt') currentItem.health_cur -= 2;
        }

        /** @type {Item[]} */
        const itemsDecayed = [];
        //Modify current things
        if(type === 'decay') {
            if(itemsAlive.some(v => v.health_cur > 1)) {
                itemsAlive.forEach(v => {
                    if(v.health_cur > 0) {
                        v.health_cur -= 1;
                        itemsDecayed.push(v);
                    }
                });
            }
        }

        //Decide if game is over
        let isGameOver = false;
        const newDeathOrder = 1 + items.reduce(highestDeathOrderThingInGame, 0)
        for(let i = 0; i < itemsAlive.length; i++) {
            const item = itemsAlive[i];

            if(item.health_cur <= 0) {
                //Give out placement
                if(item.death_order == null)
                    item.death_order = newDeathOrder;
                
                itemsAlive.splice(i, 1);
                i--;
            }
        }

        if(itemsAlive.length <= 1) {
            await query(`UPDATE hurtheal_games SET finished = TRUE WHERE id = ?`, [resultGames.id]);
            isGameOver = true;
        }

        if(isGameOver) {
            let winnerThing = items.find((v => v.health_cur > 0));
            if(winnerThing) {
                winnerThing.death_order = items.reduce(highestDeathOrderThingInGame, 0) + 1;
                await query(`UPDATE hurtheal_things SET death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [winnerThing.death_order, resultGames.id, winnerThing.id]);
            }
        }

        //Update database
        //If an item was targeted, we know only to update that one. otherwise update all of them
        if(currentItem != null) {
            await query(`UPDATE hurtheal_things SET health_cur = ?, death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [currentItem.health_cur, currentItem.death_order, resultGames.id, currentItem.id]);
            await query(`INSERT INTO hurtheal_actions (id_hurtheal_things, timestamp, user_id, action, reason) VALUES (?, ?, ?, ?, ?)`, [currentItem.id, now, m.member.id, type, reason]);
        }
        else {
            for(let item of itemsDecayed) {
                await query(`UPDATE hurtheal_things SET health_cur = ?, death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [item.health_cur, item.death_order, resultGames.id, item.id]);
                await query(`INSERT INTO hurtheal_actions (id_hurtheal_things, timestamp, user_id, action, reason) VALUES (?, ?, ?, ?, ?)`, [item.id, now, m.member.id, type, reason]);
            }
        }

        await query(`UPDATE hurtheal_games SET last_decay_timestamp = ? WHERE id = ?`, [now, resultGames.id]);

        //Refresh actions
        /** @type {Db.hurtheal_actions[]} */
        resultsActions = await getActionsWithSort(resultGames);

        //Sort things again for final message after changes
        sortThings(items);

        //Send final message
        await sendNewGameMessage.call(this, m, query, type, await getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, action: type, gameOver: isGameOver}), isGameOver, isGameOver ? resultGames : undefined);
    });
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {number} id
 */
function chart(m, id) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.hurtheal_games} */
        let resultGame = (await query(`SELECT * FROM hurtheal_games WHERE id = ?`, [id])).results[0];
        if(!resultGame) {
            await handleHHMessage.call(this, query, m.message, false, "Invalid game ID provided", m.channel, true, false);
            return;
        }
        
        let buffer1 = await getChartFromGame.call(this, query, resultGame, 'actions');
        let buffer2 = await getChartFromGame.call(this, query, resultGame, 'time');
        await handleHHMessage.call(this, query, m.message, false, {content: 'Item health per actions', files: [buffer1]}, m.channel, false, false);
        await handleHHMessage.call(this, query, m.message, false, {content: 'Item health per time', files: [buffer2]}, m.channel, false, false);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 */
function list(m) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.hurtheal_games[]} */
        let resultsGame = (await query(`select * from hurtheal_games where id not in (select id_hurtheal_games from hurtheal_things where death_order is null and id_hurtheal_games = hurtheal_games.id) order by hurtheal_games.id desc`)).results;
        let page = 1;
        const embed = getListEmbed(resultsGame, page, false);
        if(embed == null) {
            m.channel.send('No HH game was ever recorded.').catch(logger.error);
            return;
        }
        const maxPages = Math.floor(resultsGame.length / ENTRIES_PER_LIST_PAGE) + 1;

        const message = await m.channel.send({ embeds: [embed] });
        const collector = message.createReactionCollector({
            time: 1000 * 60 * 10,
        })

        collector.on('collect', async (reaction, user) => {
            //do not remove if bot
            if(message.member && user.id === message.member.id) return;
            await reaction.users.remove(user);
            if(user.id !== m.member.id) return;

            switch(reaction.emoji.name) {
            case '⬅️':
                if(page === 1) return;
                page = Math.max(1, page - 5);
                break;
            case '◀️':
                if(page === 1) return;
                page--;
                break;
            case '▶️':
                if(page === maxPages) return;
                page++;
                break;
            case '➡️':
                if(page === maxPages) return;
                page = Math.min(maxPages, page + 5);
                break;
            }

            const embed = getListEmbed(resultsGame, page, false);
            if(embed) await message.edit({ embeds: [embed] });
        });

        collector.on('end', async () => {
            await message.reactions.removeAll();
            const embed = getListEmbed(resultsGame, page, true);
            if(embed) await message.edit({ embeds: [embed] });
        });

        await message.react('⬅️');
        await message.react('◀️');
        await message.react('▶️');
        await message.react('➡️');
    }).catch(logger.error);
}







/**
 * 
 * @param {Db.hurtheal_games[]} resultsGame
 * @param {number} page
 * @param {boolean} end
 * @returns {Discord.MessageEmbed|null}
 */
function getListEmbed(resultsGame, page, end) {
    var embed = new Discord.MessageEmbed({
        color: 14211288,
        timestamp: Date.now(),
        description: '**Hurt or Heal**\n\n',
    });

    embed.description += `Page ${page}\n\n`

    const startAtIndex = (page - 1) * ENTRIES_PER_LIST_PAGE;
    //if page is out of bounds, return null
    if(startAtIndex >= resultsGame.length) return null;
    const gamesSliced = resultsGame.slice(startAtIndex, startAtIndex + ENTRIES_PER_LIST_PAGE);

    for(let i = 0; i < gamesSliced.length; i++) {
        const game = gamesSliced[i];
        embed.description += `Game \`#${game.id}\`: ${game.theme == null ? 'No theme' : game.theme} *(${Bot.Util.getFormattedDate(game.timestamp, false)})*\n`;
    }

    if(!end) embed.description += `\nReact with arrows to switch pages.`;

    return embed;
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m
 * @param {SQLWrapper.Query} query 
 * @param {"hurt" | "heal" | "show" | "decay"} type
 * @param {Discord.MessageEmbed} embed
 * @param {boolean=} noRegister - Don't register this message as one that should be deleted later
 * @param {Db.hurtheal_games=} game - Database game ID. Only include this if you want the message to include the image chart of the game
 */
async function sendNewGameMessage(m, query, type, embed, noRegister, game) {
    let image1 = game != null ? await getChartFromGame.call(this, query, game, 'actions') : null;
    let image2 = game != null ? await getChartFromGame.call(this, query, game, 'time') : null;

    const message = await handleHHMessage.call(this, query, m.message, type === 'show' ? true : false, { embeds: [embed] }, m.channel, false, false);
    if(image1) await handleHHMessage.call(this, query, m.message, false, {content: 'Item health per actions', files: [image1]}, m.channel, false, false);
    if(image2) await handleHHMessage.call(this, query, m.message, false, {content: 'Item health per time', files: [image2]}, m.channel, false, false);

    /** @type {Db.hurtheal_setup=} */
    let resultSetup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ? FOR UPDATE`, [m.guild.id])).results[0];

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
 * @param {object} options
 * @param {'current'|'last'} options.mode
 * @param {Item[]} options.things
 * @param {(Db.hurtheal_games|number)=} options.game
 * @param {(Db.hurtheal_actions[])=} options.allActions
 * @param {('hurt'|'heal'|'decay')=} options.action - If undefined, no action was taken
 * @param {boolean=} options.gameOver - Is the game over
 * @returns {Promise<Discord.MessageEmbed>}
 */
async function getGameStandingsEmbed(m, options) {
    const game = options.game;
    const action = options.action;
    const mode = options.mode;
    const allActions = options.allActions;
    const things = options.things;
    const gameOver = options.gameOver;

    var embed = new Discord.MessageEmbed({
        color: 14211288,
        timestamp: Date.now(),
        footer: {
            text: `\`!hh rules\` for help${game != null ? ` • Game ${typeof game === 'number' ? `${game}` : `${game.id}`}` : ''}`
        }
    });
    if(action == 'hurt') embed.color = 16731994;
    else if(action == 'heal') embed.color = 6214143;
    else if(action == 'decay') embed.color = 16153855;

    embed.description = `**🎮 Hurt or Heal**${typeof game === 'object' && game.theme ? `: *${game.theme}*` : ''}\n`;
    if(gameOver) embed.description += `\n**The game is over!**\n`;

    embed.description += `${mode === 'current' ? '' : 'Previous game\'s results:\n'}`;

    let space = things.length >= 10 ? ' ' : '';

    for(let thing of things) {
        embed.description += `\`${getHealthBar.call(this, thing, Math.min(this.barLength, things.reduce((p, v) => Math.max(p, v.health_max), 0)))}\` \`${space && thing.orderId < 10 ? ' ':''}#${thing.orderId}\` **${thing.name}** ${getThingPlace(thing, things)}\n`;
    }

    embed.description += '\n';

    if(allActions != null) {
        let actions = allActions.slice(0, this.lastActionsShown);
        if(actions.length > 0) embed.description += '**Last few actions**\n';

        for(let i = 0; i < actions.length; i++) {
            let action = actions[i];
            let thing = things.find((v => v.id === action.id_hurtheal_things))
            let missing = false;
            if(await m.guild.members.fetch(action.user_id).catch(() => {}) == null) missing = true;
            
            let str = (() => {
                if(action.action === 'decay') return `<@${action.user_id}> reduced the health of all items by 1 due to daily decay.`;
                return `${missing ? 'Missing user' : `<@${action.user_id}>`} ${this.dictionary[action.action]} ${thing ? `**${thing.name}**` : 'unknown'} ${missing ? '' : ` ${action.reason ? Discord.Util.escapeMarkdown(action.reason) : ''}`}`;
            })();
            if(i < this.lastActionsCounted) str = `\\> ${str}`;
            embed.description += `${str}\n`;
        }

        /** @type {Object.<string, number>} */let users = {};
        for(let action of allActions) {
            if(users[action.user_id] == null) users[action.user_id] = 0;
            users[action.user_id]++;
        }
        let playersCount = Object.keys(users).length;
        let actionsCount = allActions.length;
        embed.description += `${playersCount} player${playersCount != 1 ? 's':''} performed ${actionsCount} action${actionsCount != 1 ? 's':''}.\n`;

        if(gameOver) {
            /** @type {{user: Discord.Snowflake, actionCount: number}[]} */let usersArr = [];
            for(let keyval of Object.entries(users)) usersArr.push({ user: keyval[0], actionCount: keyval[1] });
            usersArr.sort((a, b) => b.actionCount - a.actionCount);
            let str = 'Most actions: ';
            let len = Math.min(10, usersArr.length);
            for(let i = 0; i < len; i++) {
                let user = usersArr[i];
                if(i !== 0) str += ', ';
                str += `<@${user.user}> (${user.actionCount})`;
            }
            if(len < usersArr.length)
                str += ` __and ${usersArr.length - len} other players__`
            embed.description += `${str}\n`;
        }
    }

    return embed;
}

/**
 * @this {HurtHeal}
 * @param {Db.hurtheal_things} thing
 * @param {number} barLength
 * @returns {string}
 */
function getHealthBar(thing, barLength) {
    let str = '';
    let health = thing.health_cur <= 0 ? 0 : thing.health_cur;
    let overheals = 10;

    let bars = [];
    for(let i = 0; i < overheals; i++) {
        bars[i] = thing.health_cur - thing.health_max * i;
    }

    for(let i = 0; i < barLength; i++) {
        let type = -1;
        for(let j = overheals - 1; j >= 0; j--) {
            if(i < Math.ceil(bars[j] / thing.health_max * barLength)) {
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
    const highestDeathOrder = Math.min(things.reduce(highestDeathOrderThingInGame, 0), things.length);
    const place = highestDeathOrder - thing.death_order + 1 + things.reduce((pv, cv) => { if(cv.death_order == null) return ++pv; return pv; }, 0);
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

/**
 * @this {HurtHeal}
 * @param {SQLWrapper.Query} query
 * @param {Db.hurtheal_games} game
 * @param {'time'|'actions'} type
 * @returns {Promise<Buffer>}
 */
async function getChartFromGame(query, game, type) {
    /** @type {Db.hurtheal_things[]} */
    let allThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ?`, [game.id])).results;
    /** @type {Db.hurtheal_actions[]} */
    let allActions = (await query(`SELECT * FROM hurtheal_actions ha JOIN hurtheal_things ht ON ha.id_hurtheal_things = ht.id WHERE ht.id_hurtheal_games = ?`, [game.id])).results;

    let axesMin = 0;
    let axesMax = 0;
    for(let thing of allThings) axesMax = Math.max(axesMax, thing.health_max);

    /** @type {{id_hurtheal_things: number[], action: 'hurt'|'heal'|'decay', timestamp: number}[]} */
    let actionsCollapsed = [];
    for(let i = 0; i < allActions.length; i++) {
        let action = allActions[i];

        //collapse actions with identical timestamp
        if(actionsCollapsed.length > 0 && 
            actionsCollapsed[actionsCollapsed.length - 1].timestamp === action.timestamp && 
            actionsCollapsed[actionsCollapsed.length - 1].action === action.action) {
            actionsCollapsed[actionsCollapsed.length - 1].id_hurtheal_things.push(action.id_hurtheal_things);
        }
        else {
            actionsCollapsed.push({ id_hurtheal_things: [action.id_hurtheal_things], action: action.action, timestamp: action.timestamp });
        }
    }

    /** @type {import('chart.js').ChartConfiguration} */
    let chart = {
        type: 'line',
        data: {
            datasets: (() => {
                /** @type {{label: string, data: number[], borderColor: string}[]} */
                let arr = [];
                for(let i = 0; i < allThings.length; i++) {
                    let thing = allThings[i];

                    let health = thing.health_max + (i / (allThings.length * 5));
                    let color = this.colorOverrides[thing.name];
                    if(color == null) {
                        color = this.chartColors[i];
                        color = color == null ? '#000000AA' : `${color}AA`;
                    }

                    let set = {label: thing.name, data: [health], borderColor: color};
                    arr.push(set);
                    for(let action of actionsCollapsed) {
                        if(action.id_hurtheal_things.includes(thing.id)) {
                            switch(action.action) {
                            case 'hurt': health -= 2; break;
                            case 'heal': health += 1; break;
                            case 'decay': health -= 1; break;
                            }
                        }
                        health = Math.max(health, 0);
                        set.data.push(health);
                    }
                }
                return arr;
            })(),
        },
        options: {
            datasets: {
                line: {
                    pointRadius: 0,
                    borderWidth: 2
                }
            },
            layout: {
                padding: {
                    top: 5
                }
            },
            plugins: {
                title: {
                    display: game.theme != null,
                    text: game.theme
                }
            },
            scales: {
                y: {
                    suggestedMax: axesMax,
                    suggestedMin: axesMin,
                    ticks: {
                        stepSize: 1,
                    }
                }
            },
        },
        plugins: [{
            id: 'discord-fill-bg',
            beforeDraw: function(chart, args, options) {
                let ctx = chart.ctx;
                ctx.fillStyle = '#36393F';
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        }]
    }

    if(type === 'actions') {
        chart.data.labels = (() => {
            let arr = [0];
            for(let i = 1; i < actionsCollapsed.length + 1; i++)
                arr.push(i);
            return arr;
        })();
    }
    else if(type === 'time') {
        chart.data.labels = (() => {
            let arr = [];
            for(let action of actionsCollapsed) arr.push(action.timestamp);
            return arr;
        })();

        const options = chart.options;
        if(options && options.scales) {
            options.scales.x = {
                type: 'time',
                time: {
                    displayFormats: {
                        quarter: 'MMM YYYY'
                    }
                }
            }
        }
    }

    return await chartJSNodeCanvas.renderToBuffer(chart);
}

/**
 * @this {HurtHeal}
 * @param {SQLWrapper.Query} query
 * @param {Discord.Message} userMessage
 * @param {boolean|number} userMessageDelete - if true, delete after 10 seconds. if number, delete after provided number of seconds.
 * @param {string | Discord.MessagePayload | Discord.MessageOptions} botMessage
 * @param {Discord.PartialDMChannel | Discord.TextChannel | Discord.ThreadChannel} botChannel
 * @param {boolean} isReply
 * @param {boolean} botMessageDelete
 * @returns {Promise<Discord.Message>}
 */
async function handleHHMessage(query, userMessage, userMessageDelete, botMessage, botChannel, isReply, botMessageDelete) {
    let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE`)).results[0];
    if(resultGames == null) {
        userMessageDelete = false;
        botMessageDelete = false;
    }

    if(+userMessageDelete > 0) setTimeout(() => userMessage.delete().catch(logger.error), typeof userMessageDelete === 'number' ? userMessageDelete * 1000 : 10000);
    
    const message = await (async () => {
        if(isReply) return await userMessage.reply(botMessage);
        else return await botChannel.send(botMessage);
    })();

    if(botMessageDelete) setTimeout(() => message.delete().catch(logger.error), 30000);
    if(userMessage.guild) {
        this.noDeleteCache.set(userMessage.id, userMessage);

        //TODO currently bot messages aren't sent to onMessage. This means we can't delete them from there,
        //so no use sending them to the no delete cache, as all they will do is leak memory there.
        //If it is needed, this should be uncommented.
        //this.noDeleteCache.set(message.id, message);
    }

    return message;
}