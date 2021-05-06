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
 */


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
                action VARCHAR(16) NOT NULL
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
            let error = `Arguments error found at item **%0**: %1. Make sure arguments are in the correct order.`;
            arg = arg.replace(/\s\s+/g, ' '); //Reduce all multi spaces, newlines etc. to single space
            let argsThings = arg.split(',');

            if(arg.length === 0) return 'Must provide some arguments';

            /** @type {Object.<string, number>} */
            let obj = {}

            for(let argsThing of argsThings) {
                argsThing = argsThing.trim();
                let thingValues = argsThing.split(' ');
                let name = thingValues[0];
                if(name.length <= 0)         return error.replace('%0', 'empty').replace('%1', 'Name is empty or invalid');
                let health = Math.ceil(+thingValues[1]);
                if(health < 1)               return error.replace('%0', name).replace('%1', 'Health must be 1 or more');
                if(!Number.isFinite(health)) return error.replace('%0', name).replace('%1', 'Health is not a valid number');

                obj[name] = health;
            }

            /** @type {{name: string, health: number}[]} */
            let things = [];
            for(let o of Object.entries(obj))
                things.push({name: o[0], health: o[1]});

            start.call(this, m, things);
            break;
        }
        case 'show':
        case 'hurt':
        case 'heal': {
            let str = args[0];
            action.call(this, m, ext.action, str);    
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
        let insertId = (await query(`INSERT INTO hurtheal_games (guild_id, timestamp, finished) VALUES ('${m.guild.id}', '${Date.now()}', FALSE)`)).results.insertId;

        for(let thing of things) {
            await query(`INSERT INTO hurtheal_things (id_hurtheal_games, name, health_cur, health_max) VALUES ('${insertId}', ${mysql.escape(thing.name)}, '${thing.health}', '${thing.health}')`);
        }

        /** @type {Db.hurtheal_things[]} */
        let resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ${insertId} ORDER BY health_cur DESC`)).results;

        m.message.reply('New game started!', { embed: getGameStandingsEmbed.call(this, m, 'current', resultsThings) }).catch(logger.error);
    }).catch(logger.error);
}

/**
 * @this {HurtHeal}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'hurt'|'heal'|'show'} type
 * @param {string=} thingName
 */
function action(m, type, thingName) {
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
        let resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ${resultGames.id} ORDER BY health_cur DESC`)).results;
        /** @type {Db.hurtheal_actions[]} */
        let resultsActions = (await query(`SELECT * FROM hurtheal_actions WHERE id_hurtheal_games = ${resultGames.id} ORDER BY id DESC LIMIT 0, 2`)).results;

        //Sort results for exit commands
        sortThings(resultsThings);

        if(type === 'show') {
            await sendNewGameMessage(m, query, '', getGameStandingsEmbed.call(this, m, mode, resultsThings, resultGames, resultsActions));
            return;
        }

        if(resultsActions.find((v => v.user_id === m.member.id))) {
            await sendNewGameMessage(m, query, 'You have already played within the last 2 actions! Please wait your turn.', getGameStandingsEmbed.call(this, m, mode, resultsThings, resultGames, resultsActions));
            return;
        }

        if(thingName == null) {
            await sendNewGameMessage(m, query, `You must choose an item to ${type}.\nExample: \`!hh ${type} thing\``, getGameStandingsEmbed.call(this, m, mode, resultsThings, resultGames, resultsActions));
            return;
        }

        if(mode === 'last') {
            await sendNewGameMessage(m, query, 'A game is not currently running.', getGameStandingsEmbed.call(this, m, mode, resultsThings, resultGames, resultsActions));
            return;
        }

        /** @type {Db.hurtheal_things[]} */
        let resultsThingsAlive = [];
        for(let resultThings of resultsThings)
            if(resultThings.health_cur > 0) resultsThingsAlive.push(resultThings);
        
        let currentThing = resultsThings.find((v => simplifyForTest(v.name) === simplifyForTest(thingName)));
        if(currentThing == null) {
            await sendNewGameMessage(m, query, `**${thingName}** is not part of the current game.\nYou can select from: **${resultsThingsAlive.map((v => v.name)).join(', ')}**`, getGameStandingsEmbed.call(this, m, mode, resultsThings, resultGames, resultsActions));
            return;
        }
        if(currentThing.health_cur <= 0) {
            await sendNewGameMessage(m, query, `**${thingName}** is out of the game. You can only select from: **${resultsThingsAlive.map((v => v.name)).join(', ')}**`, getGameStandingsEmbed.call(this, m, mode, resultsThings, resultGames, resultsActions));
            return;
        }

        //Modify current thing
        switch(type) {
        case 'heal': { currentThing.health_cur += 1; break; }
        case 'hurt': { currentThing.health_cur -= 2; break; }
        }

        //Decide if game is over
        let isGameOver = false;
        if(currentThing.health_cur <= 0) resultsThingsAlive.splice(resultsThingsAlive.indexOf(currentThing), 1);
        if(resultsThingsAlive.length <= 1) {
            await query(`UPDATE hurtheal_games SET finished = TRUE WHERE id = '${resultGames.id}'`);
            isGameOver = true;
        }

        //Give out placement
        if(currentThing.health_cur <= 0)
            currentThing.death_order = resultsThings.filter((v => v.health_cur <= 0)).length;
        if(isGameOver) {
            let winnerThing = resultsThings.find((v => v.health_cur > 0));
            if(winnerThing) {
                winnerThing.death_order = resultsThings.length;
                await query(`UPDATE hurtheal_things SET death_order = '${winnerThing.death_order}' WHERE id_hurtheal_games = '${resultGames.id}' AND id = '${winnerThing.id}'`);
            }
        }

        //Update database
        await query(`UPDATE hurtheal_things SET health_cur = ${currentThing.health_cur}${currentThing.death_order != null ? `, death_order = ${currentThing.death_order}` : ''} WHERE id_hurtheal_games = '${resultGames.id}' AND id = '${currentThing.id}'`);
        await query(`INSERT INTO hurtheal_actions (id_hurtheal_games, id_hurtheal_things, timestamp, user_id, action) VALUES ('${resultGames.id}', '${currentThing.id}', '${Date.now()}', '${m.member.id}', '${type}')`);

        //Refresh actions
        /** @type {Db.hurtheal_actions[]} */
        resultsActions = (await query(`SELECT * FROM hurtheal_actions WHERE id_hurtheal_games = ${resultGames.id} ORDER BY id DESC LIMIT 0, 2`)).results;

        //Sort things again for final message after changes
        sortThings(resultsThings);

        //Send final message
        await sendNewGameMessage(m, query, `**${currentThing.name}** was ${this.dictionary[type]} and is now at **${currentThing.health_cur}** health.${isGameOver ? `\n**The game is over!**`:''}`, getGameStandingsEmbed.call(this, m, mode, resultsThings, resultGames, resultsActions, type), isGameOver ? true : false);
    }).catch(logger.error);
}

/**
 * @param {Bot.Message} m
 * @param {SQLWrapper.Query} query 
 * @param {string} str
 * @param {Discord.MessageEmbed} embed
 * @param {boolean=} noRegister - Don't register this message as one that should be deleted later
 */
async function sendNewGameMessage(m, query, str, embed, noRegister) {
    const message = await m.channel.send(str, { embed: embed });

    /** @type {Db.hurtheal_setup=} */
    let resultSetup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ${m.guild.id}`)).results[0];

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
        await query(`INSERT INTO hurtheal_setup (guild_id, last_message_id, last_channel_id) VALUES ('${m.guild.id}', '${message.id}', '${message.channel.id}')`);
    else 
        await query(`UPDATE hurtheal_setup SET last_message_id = '${message.id}', last_channel_id = '${message.channel.id}' WHERE guild_id = ${m.guild.id}`);
}


/**
 * @this {HurtHeal}
 * @param {Bot.Message} m
 * @param {'current'|'last'} mode
 * @param {Db.hurtheal_things[]} things
 * @param {Db.hurtheal_games=} game
 * @param {(Db.hurtheal_actions[])=} actions
 * @param {('hurt'|'heal')=} action
 * @returns {Discord.MessageEmbed}
 */
function getGameStandingsEmbed(m, mode, things, game, actions, action) {
    var embed = new Discord.MessageEmbed({
        color: 14211288,
        author: {
            name: m.member.user.username + '#' + m.member.user.discriminator,
            iconURL: m.member.user.avatarURL() || m.member.user.defaultAvatarURL,
        },
        timestamp: Date.now(),
        footer: {
            text: '`!hh help` for help'
        }
    });
    if(action == 'hurt') embed.color = 16746895;
    else if(action == 'heal') embed.color = 8904191;

    embed.description = `${mode === 'current' ? '' : 'Last game\'s results:\n'}`;
    if(game && game.theme) {
        embed.description += `Theme: **${game.theme}**\n`;
    }

    embed.fields = [];
    for(let thing of things) {
        embed.description += `\`${getHealthBar.call(this, thing)}\` **${thing.name}** ${getThingPlace(thing, things)}\n`;
    }

    if(actions) {
        let fieldActions = { name: 'Last two actions', value: '', inline: false }
        for(let action of actions) {
            let thing = things.find((v => v.id === action.id_hurtheal_things))
            fieldActions.value += `<@${action.user_id}> ${this.dictionary[action.action]} ${thing ? `**${thing.name}**` : 'unknown'} on ${Bot.Util.getFormattedDate(action.timestamp, true)}\n`;
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
    default: return `*#${place} place*`;
    }
}

/**
 * 
 * @param {Db.hurtheal_things[]} things 
 */
function sortThings(things) {
    things.sort((a, b) => Math.max(0, b.health_cur) - Math.max(0, a.health_cur) || (b.death_order??0) - (a.death_order??0));
}

/**
 * 
 * @param {string} str 
 * @returns {string} 
 */
function simplifyForTest(str) {
    return Diacritics.remove(str).toLowerCase();
}