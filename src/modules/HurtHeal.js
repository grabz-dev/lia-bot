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

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 500, chartCallback: ChartJS => {
    ChartJS.defaults.color = '#CCCCCC';
    ChartJS.defaults.font.size = 15;
    ChartJS.defaults.font.family = "Helvetica Neue, Helvetica, Arial, sans-serif"
}});

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

        this.barLength = 10;
        this.lastActionsCounted = 2;
        this.dictionary = {
            'hurt': 'hurt',
            'heal': 'healed'
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

        /** @type {{type: 'hurt'|'heal'|'show', args: string[], arg: string}[]} */
        this.queue = [];
        this.queueRunning = false;
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
     * @param {'hurt'|'heal'|'start'|'help'|'show'|'theme'|'end'|'chart'} ext.action - Custom parameters provided to function call.
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
            this.queue.push({ type: ext.action, args, arg });
            if(this.queueRunning) break;

            (async () => {
                this.queueRunning = true;
                while(this.queue.length > 0) {
                    let qitem = this.queue[0];
                    this.queue.splice(0, 1);
                    await action.call(this, m, qitem.type, qitem.args, qitem.arg).catch(logger.error);
                }
                this.queueRunning = false;
            })();
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
        description: `Rules:\n  • Each item is assigned an amount of health at the start.\n  • Each player can either hurt an item - removing 2 health from it, or heal an item - adding 1 health to it, if it isn't at max health.\n  • A player cannot play again until two other players have performed an action.\n  • More than 2 actions cannot be performed consecutively on a single item.\n  • Feel free to add a comment to the end of each command to indicate why you chose to hurt or heal a specific item. In fact, many people may find it interesting.`
    });
    embed.fields = [];
    embed.fields.push({
        name: ':information_source: Instructions',
        value: '`!hh` to view current standings\n`!hh hurt <item> <reason?>` to hurt an item for 2 points\n`!hh heal <item> <reason?>` to heal an item for 1 point',
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

        m.message.reply('New game started!', { embed: getGameStandingsEmbed.call(this, m, {mode: 'current', things: items, game: insertId}) }).catch(logger.error);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'hurt'|'heal'|'show'} type
 * @param {string[]} args
 * @param {string} arg
 */
async function action(m, type, args, arg) {
    await this.bot.sql.transaction(async (query, mysql) => {
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

        /**
         * @param {Db.hurtheal_games} resultGames 
         * @returns {Promise<Db.hurtheal_actions[]>}
         */
        const getActionsWithSort = async (resultGames) => (await query(`SELECT * FROM hurtheal_actions ha JOIN hurtheal_things ht ON ha.id_hurtheal_things = ht.id WHERE ht.id_hurtheal_games = ? ORDER BY ha.id DESC`, [resultGames.id])).results;
        let resultsActions = await getActionsWithSort(resultGames);

        //Sort results for exit commands
        sortThings(items);

        if(type === 'show') {
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions}));
            return;
        }

        if(mode === 'last') {
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage: 'A game is not currently running.'}));
            return;
        }

        if(resultsActions.slice(0, this.lastActionsCounted).find((v => v.user_id === m.member.id))) {
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage: `You have already played within the last ${this.lastActionsCounted} actions! Please wait your turn.`}));
            return;
        }

        if(args.length === 0) {
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage: `You must choose an item to ${type}.\nExample: \`!hh ${type} thing\``}));
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
            let id = args[0].split(',')[0];
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
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage:  `Could not determine selection from input.\nMake sure to type the item ID or the full name of the item you want to hurt or heal.`}));
            return;
        }
        if(currentItem.health_cur <= 0) {
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage: `**${currentItem.name}** is out of the game. You can only select from: **${itemsAlive.map((v => v.name)).join(', ')}**`}));
            return;
        }
        if(resultsActions[0] && resultsActions[0].id_hurtheal_things === currentItem.id &&
           resultsActions[1] && resultsActions[1].id_hurtheal_things === currentItem.id) {
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage: `An action cannot be performed on the same item more than twice in a row. Please select a different item.`}));
            return;
        }
        if(type === 'heal' && currentItem.health_cur >= currentItem.health_max) {
            await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage: `**${currentItem.name}** is already at max health.`}));
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
        await query(`INSERT INTO hurtheal_actions (id_hurtheal_things, timestamp, user_id, action, reason) VALUES (?, ?, ?, ?, ?)`, [currentItem.id, Date.now(), m.member.id, type, reason]);

        //Refresh actions
        /** @type {Db.hurtheal_actions[]} */
        resultsActions = await getActionsWithSort(resultGames);

        //Sort things again for final message after changes
        sortThings(items);

        //Send final message
        await sendNewGameMessage.call(this, m, query, getGameStandingsEmbed.call(this, m, {mode, things: items, game: resultGames, allActions: resultsActions, additionalMessage: `**${currentItem.name}** was ${this.dictionary[type]} and is now at **${Math.max(0, currentItem.health_cur)}** health.`, action: type, gameOver: isGameOver}), isGameOver, isGameOver ? resultGames : undefined);
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
            m.message.reply("Invalid game ID provided").catch(logger.error);
            return;
        }
        
        let buffer = await getChartFromGame.call(this, query, resultGame);
        m.channel.send({files: [buffer]}).catch(logger.error);
    }).catch(logger.error);
}







/**
 * @this {HurtHeal}
 * @param {Bot.Message} m
 * @param {SQLWrapper.Query} query 
 * @param {Discord.MessageEmbed} embed
 * @param {boolean=} noRegister - Don't register this message as one that should be deleted later
 * @param {Db.hurtheal_games=} game - Database game ID. Only include this if you want the message to include the image chart of the game
 */
async function sendNewGameMessage(m, query, embed, noRegister, game) {
    let image = game != null ? await getChartFromGame.call(this, query, game) : null;
    const message = await m.channel.send({ embed: embed, files: image ? [image] : undefined });

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
 * @param {string=} options.additionalMessage
 * @param {(Db.hurtheal_games|number)=} options.game
 * @param {(Db.hurtheal_actions[])=} options.allActions
 * @param {('hurt'|'heal')=} options.action - If undefined, no action was taken
 * @param {boolean=} options.gameOver - Is the game over
 * @returns {Discord.MessageEmbed}
 */
function getGameStandingsEmbed(m, options) {
    const game = options.game;
    const action = options.action;
    const str = options.additionalMessage;
    const mode = options.mode;
    const allActions = options.allActions;
    const things = options.things;
    const gameOver = options.gameOver;

    var embed = new Discord.MessageEmbed({
        color: 14211288,
        author: {
            name: '🎮 Hurt or Heal',
        },
        timestamp: Date.now(),
        footer: {
            text: `\`!hh rules\` for help${game != null ? ` • Game ${typeof game === 'number' ? `${game}` : `${game.id}`}` : ''}`
        }
    });
    if(action == 'hurt') embed.color = 16731994;
    else if(action == 'heal') embed.color = 6214143;

    embed.description = '';
    if(str != null && str.length > 0) embed.description += `${action == null ? ':warning:':''} <@${m.member.id}>, ${str}\n`;
    if(gameOver) embed.description += `\n**The game is over!**\n`;
    embed.description += '\n';

    embed.description += `${mode === 'current' ? '' : 'Previous game\'s results:\n'}`;
    if(typeof game === 'object' && game.theme) {
        embed.description += `Theme: **${game.theme}**\n`;
    }

    let space = things.length >= 10 ? ' ' : '';

    embed.fields = [];
    for(let thing of things) {
        embed.description += `\`${space && thing.orderId < 10 ? ' ':''}#${thing.orderId}\` \`${getHealthBar.call(this, thing)}\` **${thing.name}** ${getThingPlace(thing, things)}\n`;
    }

    if(allActions != null) {
        let actions = allActions.slice(0, this.lastActionsCounted);
        let fieldActions = { name: `Last ${this.lastActionsCounted} actions`, value: '', inline: false }
        for(let action of actions) {
            let thing = things.find((v => v.id === action.id_hurtheal_things))
            fieldActions.value += `<@${action.user_id}> ${this.dictionary[action.action]} ${thing ? `**${thing.name}**` : 'unknown'} ${action.reason ? action.reason : ''}\n`;
        }

        /** @type {Object.<string, number>} */let users = {};
        for(let action of allActions) {
            if(users[action.user_id] == null) users[action.user_id] = 0;
            users[action.user_id]++;
        }
        let playersCount = Object.keys(users).length;
        let actionsCount = allActions.length;
        fieldActions.value += `${playersCount} player${playersCount != 1 ? 's':''} performed ${actionsCount} action${actionsCount != 1 ? 's':''}.\n`;

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
            fieldActions.value += `${str}\n`;
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

/**
 * @this {HurtHeal}
 * @param {SQLWrapper.Query} query
 * @param {Db.hurtheal_games} game
 * @returns {Promise<Buffer>}
 */
async function getChartFromGame(query, game) {
    /** @type {Db.hurtheal_things[]} */
    let allThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ?`, [game.id])).results;
    /** @type {Db.hurtheal_actions[]} */
    let allActions = (await query(`SELECT * FROM hurtheal_actions ha JOIN hurtheal_things ht ON ha.id_hurtheal_things = ht.id WHERE ht.id_hurtheal_games = ?`, [game.id])).results;

    let axesMin = 0;
    let axesMax = 0;
    for(let thing of allThings) axesMax = Math.max(axesMax, thing.health_max);

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
                    for(let action of allActions) {
                        if(action.id_hurtheal_things === thing.id) {
                            switch(action.action) {
                            case 'hurt': health -= 2; break;
                            case 'heal': health += 1; break;
                            }
                        }
                        health = Math.max(health, 0);
                        set.data.push(health);
                    }
                }
                return arr;
            })(),
            labels: (() => {
                let arr = [0];
                for(let i = 1; i < allActions.length + 1; i++)
                    arr.push(i);
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

    return await chartJSNodeCanvas.renderToBuffer(chart);
}