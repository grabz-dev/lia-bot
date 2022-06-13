'use strict';
/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
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

//hours from last action until all items lose 1 hp
const DECAY_HOURS = 12;
//for !hh list
const ENTRIES_PER_LIST_PAGE = 10;
//test mode lets you play solo
const TEST_MODE = false;

/**
 * @typedef {object} Db.hurtheal_setup
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id
 * @property {Discord.Snowflake=} channel_id
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

/** @type {Object.<string, string|undefined>} */
const colorOverrides = {
    aliceblue: 'aliceblue',
    antiquewhite: 'antiquewhite',
    aqua: 'aqua',
    aquamarine: 'aquamarine',
    azure: 'azure',
    beige: 'beige',
    bisque: 'bisque',
    black: 'black',
    blanchedalmond: 'blanchedalmond',
    blue: 'blue',
    blueviolet: 'blueviolet',
    brown: 'brown',
    burlywood: 'burlywood',
    cadetblue: 'cadetblue',
    chartreuse: 'chartreuse',
    chocolate: 'chocolate',
    coral: 'coral',
    cornflowerblue: 'cornflowerblue',
    cornsilk: 'cornsilk',
    crimson: 'crimson',
    cyan: 'cyan',
    darkblue: 'darkblue',
    darkcyan: 'darkcyan',
    darkgoldenrod: 'darkgoldenrod',
    darkgray: 'darkgray',
    darkgreen: 'darkgreen',
    darkgrey: 'darkgrey',
    darkkhaki: 'darkkhaki',
    darkmagenta: 'darkmagenta',
    darkolivegreen: 'darkolivegreen',
    darkorange: 'darkorange',
    darkorchid: 'darkorchid',
    darkred: 'darkred',
    darksalmon: 'darksalmon',
    darkseagreen: 'darkseagreen',
    darkslateblue: 'darkslateblue',
    darkslategray: 'darkslategray',
    darkslategrey: 'darkslategrey',
    darkturquoise: 'darkturquoise',
    darkviolet: 'darkviolet',
    deeppink: 'deeppink',
    deepskyblue: 'deepskyblue',
    dimgray: 'dimgray',
    dimgrey: 'dimgrey',
    dodgerblue: 'dodgerblue',
    firebrick: 'firebrick',
    floralwhite: 'floralwhite',
    forestgreen: 'forestgreen',
    fuchsia: 'fuchsia',
    gainsboro: 'gainsboro',
    ghostwhite: 'ghostwhite',
    gold: 'gold',
    goldenrod: 'goldenrod',
    gray: 'gray',
    green: 'green',
    greenyellow: 'greenyellow',
    grey: 'grey',
    honeydew: 'honeydew',
    hotpink: 'hotpink',
    indianred: 'indianred',
    indigo: 'indigo',
    ivory: 'ivory',
    khaki: 'khaki',
    lavender: 'lavender',
    lavenderblush: 'lavenderblush',
    lawngreen: 'lawngreen',
    lemonchiffon: 'lemonchiffon',
    lightblue: 'lightblue',
    lightcoral: 'lightcoral',
    lightcyan: 'lightcyan',
    lightgoldenrodyellow: 'lightgoldenrodyellow',
    lightgray: 'lightgray',
    lightgreen: 'lightgreen',
    lightgrey: 'lightgrey',
    lightpink: 'lightpink',
    lightsalmon: 'lightsalmon',
    lightseagreen: 'lightseagreen',
    lightskyblue: 'lightskyblue',
    lightslategray: 'lightslategray',
    lightslategrey: 'lightslategrey',
    lightsteelblue: 'lightsteelblue',
    lightyellow: 'lightyellow',
    lime: 'lime',
    limegreen: 'limegreen',
    linen: 'linen',
    magenta: 'magenta',
    maroon: 'maroon',
    mediumaquamarine: 'mediumaquamarine',
    mediumblue: 'mediumblue',
    mediumorchid: 'mediumorchid',
    mediumpurple: 'mediumpurple',
    mediumseagreen: 'mediumseagreen',
    mediumslateblue: 'mediumslateblue',
    mediumspringgreen: 'mediumspringgreen',
    mediumturquoise: 'mediumturquoise',
    mediumvioletred: 'mediumvioletred',
    midnightblue: 'midnightblue',
    mintcream: 'mintcream',
    mistyrose: 'mistyrose',
    moccasin: 'moccasin',
    navajowhite: 'navajowhite',
    navy: 'navy',
    oldlace: 'oldlace',
    olive: 'olive',
    olivedrab: 'olivedrab',
    orange: 'orange',
    orangered: 'orangered',
    orchid: 'orchid',
    palegoldenrod: 'palegoldenrod',
    palegreen: 'palegreen',
    paleturquoise: 'paleturquoise',
    palevioletred: 'palevioletred',
    papayawhip: 'papayawhip',
    peachpuff: 'peachpuff',
    peru: 'peru',
    pink: 'pink',
    plum: 'plum',
    powderblue: 'powderblue',
    purple: 'purple',
    red: 'red',
    rosybrown: 'rosybrown',
    royalblue: 'royalblue',
    saddlebrown: 'saddlebrown',
    salmon: 'salmon',
    sandybrown: 'sandybrown',
    seagreen: 'seagreen',
    seashell: 'seashell',
    sienna: 'sienna',
    silver: 'silver',
    skyblue: 'skyblue',
    slateblue: 'slateblue',
    slategray: 'slategray',
    slategrey: 'slategrey',
    snow: 'snow',
    springgreen: 'springgreen',
    steelblue: 'steelblue',
    tan: 'tan',
    teal: 'teal',
    thistle: 'thistle',
    tomato: 'tomato',
    turquoise: 'turquoise',
    violet: 'violet',
    wheat: 'wheat',
    white: 'white',
    whitesmoke: 'whitesmoke',
    yellow: 'yellow',
    yellowgreen: 'yellowgreen',
}


export default class HurtHeal extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
        this.commands = ['hh', 'mod_hh'];

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS hurtheal_setup (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                channel_id VARCHAR(64),
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

            await query(`ALTER TABLE hurtheal_setup ADD COLUMN channel_id VARCHAR(64)`).catch(() => {});
        }).catch(logger.error);

        this.barLength = 20;
        this.lastActionsCounted = 2;
        this.lastActionsShown = 2;

        this.dictionary = {
            'hurt': 'hurt',
            'heal': 'healed',
        }
        this.chartColors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000']
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);

        this.bot.sql.transaction(async query => {
            /** @type {Db.hurtheal_setup} */
            let setup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ?`, [guild.id])).results[0];
            if(setup != null) {
                if(setup.channel_id) this.cache.set(guild.id, 'hhChannelId', setup.channel_id);
            }
        }).catch(logger.error);
    }

    /** @param {Discord.Message} message - The message that was sent. */
    onMessage(message) {
        if(message.guild == null) return;
        if(message.channel.id !== this.cache.get(message.guild?.id, 'hhChannelId')) return;

        ((message, guild) => {
            this.bot.sql.transaction(async query => {
                let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE guild_id = ? AND finished = FALSE`, guild.id)).results[0];
                if(resultGames == null) return;

                setTimeout(() => {
                    message.delete();
                }, 5000);
            }).catch(logger.error);
        })(message, message.guild);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    loop(guild) {
        this.bot.sql.transaction(async query => {
            const ms = (1000 * 60 * 60 * DECAY_HOURS);

            /** @type {Db.hurtheal_games=} */ let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE AND guild_id = ?`, [guild.id])).results[0];
            if(resultGames == null) return;

            const now = Date.now();
            if(now - resultGames.last_decay_timestamp < ms) return;

            /** @type {Db.hurtheal_setup=} */ let resultSetup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ?`, [guild.id])).results[0];
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
            
            this.action(data.message, guild, data.message.member, data.channel, 'decay', '');
        }).catch(logger.error);
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {Discord.CommandInteraction<"cached">|Discord.Message} interaction
     * @param {Discord.Guild} guild
     * @param {string | Discord.MessagePayload | Discord.MessageOptions} botMessage
     * @param {boolean} botMessageDelete
     * @returns {Promise<Discord.Message>}
     */
    async handleHHMessage(query, interaction, guild, botMessage, botMessageDelete) {
        let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE AND guild_id = ?`, guild.id)).results[0];
        if(resultGames == null) {
            botMessageDelete = false;
        }

        /** @type {Discord.Message} */
        let message;
        if(interaction instanceof Discord.CommandInteraction) {
            message = await interaction.editReply(botMessage);
            if(botMessageDelete) setTimeout(() => interaction.deleteReply().catch(logger.error), 30000);
        }
        else {
            message = await interaction.reply(botMessage);
            if(botMessageDelete) setTimeout(() => message.delete().catch(logger.error), 30000);
        }
        return message;
    }

    /**
     * @param {Discord.CommandInteraction<"cached">|Discord.Message} interaction
     * @param {SQLWrapper.Query} query 
     * @param {Discord.Guild} guild
     * @param {Discord.MessageEmbed} embed
     * @param {boolean=} noRegister - Don't register this message as one that should be deleted later
     * @param {Db.hurtheal_games=} game - Database game ID. Only include this if you want the message to include the image chart of the game
     */
    async sendNewGameMessage(interaction, guild, query, embed, noRegister, game) {
        let image1 = game != null ? await getChartFromGame.call(this, query, game, 'actions') : null;
        let image2 = game != null ? await getChartFromGame.call(this, query, game, 'time') : null;

        const message = await this.handleHHMessage(query, interaction, guild, { embeds: [embed] }, false);
        if(image1) await message.reply({content: 'Item health per actions', files: [image1]});
        if(image2) await message.reply({content: 'Item health per time', files: [image2]});

        /** @type {Db.hurtheal_setup=} */
        let resultSetup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ? FOR UPDATE`, [guild.id])).results[0];

        if(resultSetup != null) {
            if(resultSetup.last_channel_id && resultSetup.last_message_id) {
                let channel = guild.channels.resolve(resultSetup.last_channel_id);
                if(channel instanceof Discord.TextChannel) {
                    let message = await channel.messages.fetch(resultSetup.last_message_id).catch(() => {});
                    if(message) message.delete().catch(logger.error);
                }
            }
        }

        if(noRegister)
            return;

        if(resultSetup == null)
            await query(`INSERT INTO hurtheal_setup (guild_id, last_message_id, last_channel_id) VALUES (?, ?, ?)`, [guild.id, message.id, message.channel.id]);
        else 
            await query(`UPDATE hurtheal_setup SET last_message_id = ?, last_channel_id = ? WHERE guild_id = ?`, [message.id, message.channel.id, guild.id]);
    }

    /**
     * @this {HurtHeal}
     * @param {Discord.Guild} guild
     * @param {object} options
     * @param {'current'|'last'} options.mode
     * @param {Item[]} options.things
     * @param {(Db.hurtheal_games)=} options.game
     * @param {(Db.hurtheal_actions[])=} options.allActions
     * @param {('hurt'|'heal'|'decay')=} options.action - If undefined, no action was taken
     * @param {boolean=} options.gameOver - Is the game over
     * @returns {Promise<Discord.MessageEmbed>}
     */
    async getGameStandingsEmbed(guild, options) {
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
                text: `\`/hh rules\` for help${game != null ? ` • Game ${game.id}` : ''}`
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
            embed.description += `\`${getHealthBar.call(this, thing, Math.min(this.barLength, things.reduce((p, v) => Math.max(p, v.health_max), 0)))}\` **${thing.name}** ${getThingPlace(thing, things)}\n`;
        }

        embed.description += '\n';

        if(allActions != null) {
            let actions = allActions.slice(0, this.lastActionsShown);
            if(actions.length > 0) embed.description += '**Last few actions**\n';

            for(let i = 0; i < actions.length; i++) {
                let action = actions[i];
                let thing = things.find((v => v.id === action.id_hurtheal_things))
                let missing = false;
                if(await guild.members.fetch(action.user_id).catch(() => {}) == null) missing = true;
                
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
            if(TEST_MODE) embed.description += `__The game is running in test mode.__\n`

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
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @returns {boolean}
     */
    interactionPermitted(interaction, guild, member) {
        const subcommandName = interaction.options.getSubcommand();
        switch(subcommandName) {
        case 'rules':
        case 'hurt':
        case 'heal':
        case 'show': {
            return true;
        }
        case 'theme':
        case 'end':
        case 'start':
        case 'chart':
        case 'list':
        case 'setchannel': {
            const roleId = this.bot.getRoleId(guild.id, "MODERATOR");
            if(roleId == null) return false;
            if(member.roles.cache.has(roleId)) return true;
            return false;
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
        const subcommandName = interaction.options.getSubcommand();

        if(subcommandName != 'setchannel') {
            let hhChannelId = this.cache.get(guild.id, 'hhChannelId');
            if(channel.id !== hhChannelId) {
                await interaction.reply({ content: `You can only use this command in the ${hhChannelId == null ? 'Hurt or Heal' : `<#${hhChannelId}>`} channel.`, ephemeral: true });
                return;
            };
        }

        
        switch(subcommandName) {
        case 'setchannel': {
            this.setChannel(interaction, guild, channel);
            return;
        }
        case 'rules': {
            this.rules(interaction, guild);
            return;
        }
        case 'theme': {
            let theme = interaction.options.getString('theme', true);
            this.theme(interaction, guild, theme);
            return;
        }
        case 'end': {
            this.end(interaction, guild);
            return;
        }
        case 'start': {
            let health = interaction.options.getInteger('health', true);
            let items = interaction.options.getString('items', true);
            let theme = interaction.options.getString('theme', true);

            items = items.replace(/\s\s+/g, ' '); //Reduce all multi spaces, newlines etc. to single space
            let argsThings = items.split(',');

            /** @type {Object.<string, boolean>} */
            let indexer = {}
            /** @type {{name: string, health: number}[]} */
            let things = [];

            for(let i = 0; i < argsThings.length; i++) {
                let thing = argsThings[i];

                //Trim argument
                thing = thing.trim();
                //Turn all multi spaces, tabs and newlines into a single space
                thing = thing.replace(/\s\s+/g, ' ');

                //Determine item
                let name = thing;
                if(name.length <= 0) continue;
                if(indexer[name] == null)
                    things.push({name: name, health: health});
                indexer[name] = true;
            }

            this.start(interaction, guild, things, theme);
            break;
        }
        case 'hurt':
        case 'heal':
        case 'show': {
            if(subcommandName === 'hurt' || subcommandName === 'heal') {
                let item = interaction.options.getString('item', true);
                let reason = interaction.options.getString('reason');
                await this.action(interaction, guild, member, channel, subcommandName, item, reason??"");
            }
            else {
                await this.action(interaction, guild, member, channel, subcommandName, "", "");
            }
            break;
        }
        case 'chart': {
            let id = interaction.options.getInteger('id', true);
            this.chart(interaction, guild, id);
            break;
        }
        case 'list': {
            this.list(interaction, guild, member);
            break;
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
            .setName('mod_hh')
            .setDescription('[Mod] Collection of Hurt or Heal related commands.')
            .setDefaultMemberPermissions('0')
            .addSubcommand(subcommand =>
                subcommand.setName('setchannel')
                    .setDescription('[Mod] Set the Hurt or Heal channel.')
            ).addSubcommand(subcommand =>
                subcommand.setName('theme')
                    .setDescription('[Mod] Set the current Hurt or Heal game\'s theme name.')
                    .addStringOption(option =>
                        option.setName('theme')
                            .setDescription('The theme name to set.')
                            .setRequired(true)  
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('end')
                    .setDescription('[Mod] Ends the current Hurt or Heal game.')
            ).addSubcommand(subcommand =>
                subcommand.setName('chart')
                    .setDescription('[Mod] Display charts from a specified previous Hurt or Heal game.')
                    .addIntegerOption(option => 
                        option.setName('id')
                            .setDescription('The ID of the Hurt or Heal game.')
                            .setRequired(true)    
                    )
            ).addSubcommand(subcommand =>
                subcommand.setName('list')
                    .setDescription('[Mod] Show a list of all previous Hurt or Heal games.')
            ).addSubcommand(subcommand =>
                subcommand.setName('start')
                    .setDescription('[Mod] Start a new Hurt or Heal game.')
                    .addIntegerOption(option =>
                        option.setName('health')
                            .setDescription('The amount of health that each item in this game will have.')
                            .setRequired(true)    
                    ).addStringOption(option =>
                        option.setName('items')
                            .setDescription('A comma delimited list of all the items that will appear in this game.')
                            .setRequired(true)    
                    ).addStringOption(option =>
                        option.setName('theme')
                            .setDescription('The theme of this game.')
                            .setRequired(true)  
                    )
            ).toJSON(),
        ]
    }

    /**
     * @param {Discord.Guild} guild
     * @returns {Promise<RESTPostAPIApplicationCommandsJSONBody[]>}
     */
    async getSlashCommandsAsync(guild) {
        return await this.bot.sql.transaction(async query => {
            /** @type {Db.hurtheal_games|null} */
            let game = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE AND guild_id = ?`, [guild.id])).results[0];
            /** @type {Db.hurtheal_things[]|null} */
            let resultsThings = null;

            if(game != null) resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ? ORDER BY id ASC`, [game.id])).results;

            console.log(resultsThings);

            let builder = new SlashCommandBuilder()
            .setName('hh')
            .setDescription('Collection of Hurt or Heal related commands.')
            .addSubcommand(subcommand =>
                subcommand.setName('rules')
                    .setDescription('View the rules of Hurt or Heal.')
            ).addSubcommand(subcommand =>
                subcommand.setName('show')
                    .setDescription('Display the current standings, without performing an action.')
            )

            if(resultsThings != null && resultsThings.length > 0) {
                /** @type {{name: string, value: string}[]} */
                let choices = [];
                for(const thing of getItemsFromDb(resultsThings)) {
                    if(thing.death_order == null) {
                        choices.push( { name: thing.name, value: thing.name } );
                    }
                }

                if(choices.length > 0) {
                    builder.addSubcommand(subcommand =>
                        subcommand.setName('hurt')
                            .setDescription('Hurt an item.')
                            .addStringOption(option =>
                                option.setName('item')
                                    .setDescription('The item to hurt.')
                                    .setRequired(true)
                                    .addChoices(...choices)
                            ).addStringOption(option =>
                                option.setName('reason')
                                    .setDescription('The reason why you would hurt this item.')
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('heal')
                            .setDescription('Heal an item.')
                            .addStringOption(option =>
                                option.setName('item')
                                    .setDescription('The item to heal.')
                                    .setRequired(true)
                                    .addChoices(...choices)
                            ).addStringOption(option =>
                                option.setName('reason')
                                    .setDescription('The reason why you would heal this item.')
                            )
                    );
                }
            }
            else {
                builder.addSubcommand(subcommand =>
                    subcommand.setName('hurt')
                        .setDescription('Hurt an item.')
                        .addStringOption(option =>
                            option.setName('item')
                                .setDescription('The item to hurt.')
                                .setRequired(true)
                        ).addStringOption(option =>
                            option.setName('reason')
                                .setDescription('The reason why you would hurt this item.')
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('heal')
                        .setDescription('Heal an item.')
                        .addStringOption(option =>
                            option.setName('item')
                                .setDescription('The item to heal.')
                                .setRequired(true)
                        ).addStringOption(option =>
                            option.setName('reason')
                                .setDescription('The reason why you would heal this item.')
                        )
                );
            }

            return [builder.toJSON()];
        });
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     */
    setChannel(interaction, guild, channel) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            /** @type {Db.hurtheal_setup=} */
            let resultSetup = (await query(`SELECT * FROM hurtheal_setup WHERE guild_id = ? FOR UPDATE`, [guild.id])).results[0];

            if(resultSetup == null)
                await query(`INSERT INTO hurtheal_setup (guild_id, channel_id) VALUES (?, ?)`, [guild.id, channel.id]);
            else 
                await query(`UPDATE hurtheal_setup SET channel_id = ? WHERE guild_id = ?`, [channel.id, guild.id]);

            this.cache.set(guild.id, 'hhChannelId', channel.id);

            await interaction.editReply('Channel set.');
        }).catch(logger.error);
    }


    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     */
    rules(interaction, guild) {
        let embed = new Discord.MessageEmbed({
            color: 14211288,
            title: 'Hurt or Heal',
            description: `Rules:\n  • Each item is assigned an amount of health at the start.\n  • Each player can either hurt an item - removing 2 health from it, or heal an item - adding 1 health to it, if it isn't at max health.\n  • A player cannot play again until two other players have performed an action.\n  • More than 2 actions cannot be performed consecutively on a single item.\n  • Feel free to add a comment to the end of each command to indicate why you chose to hurt or heal a specific item. In fact, many people may find it interesting.`
        });
        embed.fields = [];
        embed.fields.push({
            name: ':information_source: Instructions',
            value: '`/hh show` to view current standings\n`/hh hurt` to hurt an item for 2 points\n`/hh heal` to heal an item for 1 point',
            inline: false
        });

        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            await this.handleHHMessage(query, interaction, guild, { embeds: [embed] }, false);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     * @param {string} str
     */
    theme(interaction, guild, str) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            let started = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE AND guild_id = ?`, [guild.id])).results[0];
            if(started == null) {
                await this.handleHHMessage(query, interaction, guild, 'A Hurt or Heal game must be running to set its theme.', true);
                return;
            }

            await query(`UPDATE hurtheal_games SET theme = ? WHERE finished = FALSE`, [str]);
            await this.handleHHMessage(query, interaction, guild, 'Theme set.', true);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     */
    end(interaction, guild) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            let started = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE AND guild_id = ?`, [guild.id])).results[0];
            if(started == null) {
                await this.handleHHMessage(query, interaction, guild, 'A Hurt or Heal game must be running to end it.', true);
                return;
            }

            await query(`UPDATE hurtheal_games SET finished = TRUE`);
            await this.handleHHMessage(query, interaction, guild, 'Previous game ended.', false);
        }).then(() => {
            this.bot.refreshGuildSlashCommands(guild);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     * @param {{name: string, health: number}[]} things
     * @param {string} theme
     */
    start(interaction, guild, things, theme) {
        this.bot.sql.transaction(async (query, mysql) => {
            await interaction.deferReply();
            let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE AND guild_id = ? FOR UPDATE`, [guild.id])).results[0];
            if(resultGames != null) {
                await this.handleHHMessage(query, interaction, guild, 'A game is already running, to force finish it use `/hh end`', true);
                return;
            }

            /** @type {number} */
            const now = Date.now();
            /** @type {number} */
            let insertId = (await query(`INSERT INTO hurtheal_games (guild_id, timestamp, finished, last_decay_timestamp, theme) VALUES (?, ?, FALSE, ?, ?)`, [guild.id, now, now, theme])).results.insertId;
            /** @type {Db.hurtheal_games} */
            let game = (await query(`SELECT * FROM hurtheal_games WHERE id = ?`, [insertId])).results[0];

            for(let thing of things) {
                await query(`INSERT INTO hurtheal_things (id_hurtheal_games, name, health_cur, health_max) VALUES (?, ?, ?, ?)`, [insertId, thing.name, thing.health, thing.health]);
            }

            /** @type {Db.hurtheal_things[]} */
            let resultsThings = (await query(`SELECT * FROM hurtheal_things WHERE id_hurtheal_games = ? ORDER BY id ASC`, [insertId])).results;
            let items = getItemsFromDb(resultsThings);

            await this.handleHHMessage(query, interaction, guild, { content: 'New game started!', embeds: [await this.getGameStandingsEmbed(guild, {mode: 'current', things: items, game})] }, false);
        }).then(() => {
            this.bot.refreshGuildSlashCommands(guild);
        }).catch(logger.error);
    }

    /**
     * @this {HurtHeal}
     * @param {Discord.CommandInteraction<"cached">|Discord.Message} interaction
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     * @param {'hurt'|'heal'|'show'|'decay'} type
     * @param {string} item
     * @param {string=} reason
     */
    async action(interaction, guild, member, channel, type, item, reason) {
        await this.bot.sql.transaction(async (query, mysql) => {
            if(interaction instanceof Discord.CommandInteraction) await interaction.deferReply();
            const now = Date.now();
            let itemsKnockedOut = false;

            /** @type {Db.hurtheal_games=} */ let resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = FALSE AND guild_id = ? FOR UPDATE`, [guild.id])).results[0];
            /** @type {'current'|'last'} */ let mode = 'current';

            if(resultGames == null) {
                resultGames = (await query(`SELECT * FROM hurtheal_games WHERE finished = TRUE AND guild_id = ? ORDER BY id DESC LIMIT 0, 1`, [guild.id])).results[0];
                mode = 'last';
            }

            if(resultGames == null) {
                await this.handleHHMessage(query, interaction, guild, 'No game is running and no prior game was ever recorded.', false);
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
                await this.sendNewGameMessage(interaction, guild, query, await this.getGameStandingsEmbed(guild, {mode, things: items, game: resultGames, allActions: resultsActions}));
                return;
            }

            if(mode === 'last') {
                await this.handleHHMessage(query, interaction, guild, 'A game is not currently running.', true);
                return;
            }
            
            if(!TEST_MODE && resultsActions.slice(0, this.lastActionsCounted).find((v => v.user_id === member.id))) {
                await this.handleHHMessage(query, interaction, guild, `You have already played within the last ${this.lastActionsCounted} actions. Please wait your turn.`, true);
                return;
            }

            /** @type {Item[]} */
            let itemsAlive = [];
            for(let item of items)
                if(item.health_cur > 0) itemsAlive.push(item);
            
            /** @type {Item=} */ let currentItem;

            //Search for ID first
            if(type != 'decay') {
                currentItem = items.find(v => `${v.orderId}` === item || `#${v.orderId}` === item);

                if(currentItem == null) {
                    currentItem = items.find(v => simplifyForTest(v.name) === simplifyForTest(item))
                }
            }
            
            if(type != 'decay') {
                //If an item is still not found, error
                if(currentItem == null) {
                    await this.handleHHMessage(query, interaction, guild, `Could not determine selection from input.\nMake sure to type the item ID or the full name of the item you want to hurt or heal.`, true);
                    return;
                }
                if(currentItem.health_cur <= 0) {
                    await this.handleHHMessage(query, interaction, guild, `**${currentItem.name}** is out of the game. You can only select from: **${itemsAlive.map((v => v.name)).join(', ')}**`, true);
                    return;
                }
                if(itemsAlive.length > 2 &&
                resultsActions[0] && resultsActions[0].id_hurtheal_things === currentItem.id &&
                resultsActions[1] && resultsActions[1].id_hurtheal_things === currentItem.id) {
                    await this.handleHHMessage(query, interaction, guild, `An action cannot be performed on the same item more than twice in a row while more than two items are still in play. Please select a different item.`, true);
                    return;
                }
                if(type === 'heal' && currentItem.health_cur >= currentItem.health_max) {
                    await this.handleHHMessage(query, interaction, guild, `**${currentItem.name}** is already at max health.`, true);
                    return;
                }
                if(reason && Discord.Util.escapeMarkdown(reason).length > 255) {
                    await this.handleHHMessage(query, interaction, guild, `The given reason is too long. The character limit is 255 characters (formatting characters contribute to the character limit).`, true);
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
                    if(item.death_order == null) {
                        item.death_order = newDeathOrder;
                        itemsKnockedOut = true;
                    }
                    
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
                    itemsKnockedOut = true;
                    await query(`UPDATE hurtheal_things SET death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [winnerThing.death_order, resultGames.id, winnerThing.id]);
                }
            }

            //Update database
            //If an item was targeted, we know only to update that one. otherwise update all of them
            if(currentItem != null) {
                await query(`UPDATE hurtheal_things SET health_cur = ?, death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [currentItem.health_cur, currentItem.death_order, resultGames.id, currentItem.id]);
                await query(`INSERT INTO hurtheal_actions (id_hurtheal_things, timestamp, user_id, action, reason) VALUES (?, ?, ?, ?, ?)`, [currentItem.id, now, member.id, type, reason]);
            }
            else {
                for(let item of itemsDecayed) {
                    await query(`UPDATE hurtheal_things SET health_cur = ?, death_order = ? WHERE id_hurtheal_games = ? AND id = ?`, [item.health_cur, item.death_order, resultGames.id, item.id]);
                    await query(`INSERT INTO hurtheal_actions (id_hurtheal_things, timestamp, user_id, action, reason) VALUES (?, ?, ?, ?, ?)`, [item.id, now, member.id, type, reason]);
                }
            }

            await query(`UPDATE hurtheal_games SET last_decay_timestamp = ? WHERE id = ?`, [now, resultGames.id]);

            //Refresh actions
            /** @type {Db.hurtheal_actions[]} */
            resultsActions = await getActionsWithSort(resultGames);

            //Sort things again for final message after changes
            sortThings(items);

            //Delete user's message and post our own
            if(type !== 'decay' && currentItem != null) {
                await channel.send({
                    content: `${member.nickname??member.user.username} ${this.dictionary[type]} **${currentItem.name}** ${(reason??'').trim()}`,
                    allowedMentions: {
                        parse: ["users"]
                    }
                });
            }

            //Send final message
            await this.sendNewGameMessage(interaction, guild, query, await this.getGameStandingsEmbed(guild, {mode, things: items, game: resultGames, allActions: resultsActions, action: type, gameOver: isGameOver}), isGameOver, isGameOver ? resultGames : undefined);
            return itemsKnockedOut;
        }).then(itemsKnockedOut => {
            if(itemsKnockedOut) this.bot.refreshGuildSlashCommands(guild).catch(logger.error);
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     * @param {number} id
     */
    chart(interaction, guild, id) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            /** @type {Db.hurtheal_games} */
            let resultGame = (await query(`SELECT * FROM hurtheal_games WHERE guild_id = ? AND id = ?`, [guild.id, id])).results[0];
            if(!resultGame) {
                await this.handleHHMessage(query, interaction, guild, "Invalid game ID provided", true);
                return;
            }
            
            let buffer1 = await getChartFromGame.call(this, query, resultGame, 'actions');
            let buffer2 = await getChartFromGame.call(this, query, resultGame, 'time');
            await interaction.editReply({content: 'Item health per actions', files: [buffer1]});
            await interaction.followUp({content: 'Item health per time', files: [buffer2]});
        }).catch(logger.error);
    }

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     */
    list(interaction, guild, member) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();
            /** @type {Db.hurtheal_games[]} */
            let resultsGame = (await query(`select * from hurtheal_games where guild_id = ? AND id not in (select id_hurtheal_games from hurtheal_things where death_order is null and id_hurtheal_games = hurtheal_games.id) order by hurtheal_games.id desc`, [guild.id])).results;
            let page = 1;
            const embed = getListEmbed(resultsGame, page, false);
            if(embed == null) {
                await interaction.editReply('No HH game was ever recorded.');
                return;
            }
            const maxPages = Math.floor(resultsGame.length / ENTRIES_PER_LIST_PAGE) + 1;

            const message = await interaction.editReply({ embeds: [embed] });
            const collector = message.createReactionCollector({
                time: 1000 * 60 * 10,
            })

            collector.on('collect', async (reaction, user) => {
                //do not remove if bot
                if(message.member && user.id === message.member.id) return;
                await reaction.users.remove(user);
                if(user.id !== member.id) return;

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
                    let color = colorOverrides[thing.name.toLowerCase()];
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