'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { HttpRequest } from '../utils/HttpRequest.js';
import { KCUtil } from '../kc/KCUtil.js';

export default class Xrpl extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.maxDescLength = 200;
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
     * @param {'crpl'|'4rpl'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'crpl':
        case '4rpl': {
            let pageName = arg.replace(/[\n\r\s]+/g, '');

            switch(ext.action) {
            case 'crpl':
                getXrpl.call(this, m, 'crpl', pageName);
                return;
            case '4rpl':
                getXrpl.call(this, m, '4rpl', pageName);
                return;
            }
            }
        }
    }
}

/**
 * Get XRPL wiki page.
 * @this {Xrpl}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'crpl'|'4rpl'} xrpl
 * @param {string} pageName - The name of the wiki page.
 */
async function getXrpl(m, xrpl, pageName) {
    const urlDocs = {
        'crpl': `https://knucklecracker.com/wiki/doku.php?id=crpl:crplreference`,
        '4rpl': `https://knucklecracker.com/wiki/doku.php?id=4rpl:start`
    }
    const url = {
        'crpl': `https://knucklecracker.com/wiki/doku.php?id=crpl:docs:${pageName}`,
        '4rpl': `https://knucklecracker.com/wiki/doku.php?id=4rpl:commands:${pageName}`
    }
    const game = { 'crpl': 'cw3', '4rpl': 'cw4' }
    let wikidata = {
        title: '',
        cmd: '',
        desc: '',
    }
    let data = await HttpRequest.get(url[xrpl]);

    if(pageName.length > 0) {
        if(xrpl === '4rpl') {
            //Start processing at <!-- wikipage start -->
            data = data.substring(data.indexOf('<!-- wikipage start -->') + 1);

            //Reduce to divs containing command name and description.
            let title = data.substring(data.indexOf('<h1'), data.indexOf('</h1>'));
            data = data.substring(data.indexOf('</h1>') + 1);
            let cmd = data.substring(data.indexOf('<div'), data.indexOf('</div>'));
            data = data.substring(data.indexOf('</div>') + 1);
            let desc = data.substring(data.indexOf('<div'), data.indexOf('</div>'));
            data = data.substring(data.indexOf('</div>') + 1);

            //Clean up command name area.
            wikidata.title = title.substring(title.indexOf('>') + 1);

            //Clean up command name area.
            cmd = cmd.substring(cmd.indexOf('<p>') + 3);
            wikidata.cmd = cmd.substring(0, cmd.indexOf('</p>')).replace(/[\n\r]+/g, '');

            //Clean up description area, swap newlines to spaces, clean HTML syntax.
            desc = desc.split('<p>').join('').split('</p>').join('').replace(/[\n\r]+/g, ' ').replace(/\<(.*?)\>/g, '');
            //Save first this.maxDescLength characters of description.
            wikidata.desc = desc.substring(0, this.maxDescLength);
            //If there is more text, finish the last sentence.
            if(desc.length > this.maxDescLength) {
                desc = desc.substring(this.maxDescLength);
                wikidata.desc += desc.substring(0, desc.indexOf('.') + 1);
            }
        }
        else if(xrpl === 'crpl') {
            wikidata.desc = '*Gel maintenance in progress*; Coming soon. Sorry!';
        }
    }
    else {
        wikidata.title = ``;
        wikidata.cmd = '';
        wikidata.desc = `[${xrpl.toUpperCase()} Documentation](${urlDocs[xrpl]})`;
    }

    let emote = ':game_die:';
    await this.bot.sql.transaction(async query => {
        let result = (await query(`SELECT * FROM emotes_game
                                   WHERE guild_id = '${m.guild.id}' AND game = '${game[xrpl]}'`)).results[0];
        if(result) emote = result.emote;
    }).catch(logger.error);

    let embed = getEmbedTemplate(xrpl, m.guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''));
    if(wikidata.title.indexOf('topic does not exist') < 0) {
        embed.title = wikidata.title;
        embed.description = '';
        if(wikidata.cmd.length > 0)
            embed.description += `[${wikidata.cmd}](${url[xrpl]})\n`;
        embed.description += `${wikidata.desc}`;
    }
    else {
        embed.description = 'Command does not exist.';
    }

    m.message.reply({ embed: embed }).catch(logger.error);
}




/**
 * @this {Xrpl}
 * @param {'crpl'|'4rpl'} rpl
 * @param {Discord.GuildEmoji|null} emote
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate(rpl, emote) {
    /** @type {null|string} */
    let game = null;
    if(rpl === 'crpl') game = 'cw3';
    else if(rpl === '4rpl') game = 'cw4';

    return new Discord.MessageEmbed({
        color: game == null ? 0 : KCUtil.gameEmbedColors[game],
        author: {
            name: rpl.toUpperCase(),
            icon_url: emote ? emote.url : undefined
        },
        fields: [],
    });
}