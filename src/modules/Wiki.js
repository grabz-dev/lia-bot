'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCLocaleManager } from '../kc/KCLocaleManager.js';
import { HttpRequest } from '../utils/HttpRequest.js';
import { KCUtil } from '../kc/KCUtil.js';
import { JSDOM } from 'jsdom';

/**
 * @typedef {object} WikiData
 * @property {string} title
 * @property {string} cmd
 * @property {string} desc
 * @property {Discord.EmbedField[]} fields
 * @property {boolean} doesNotExist
 */

export default class Wiki extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        this.maxDescLength = 200;

        this.rpl = {
            'crpl': {
                game: 'cw3',
                urlDocs: 'https://knucklecracker.com/wiki/doku.php?id=crpl:crplreference',
                urlCmd: 'https://knucklecracker.com/wiki/doku.php?id=crpl:docs:',
            },
            '4rpl': {
                game: 'cw4',
                urlDocs: 'https://knucklecracker.com/wiki/doku.php?id=4rpl:start',
                urlCmd: 'https://knucklecracker.com/wiki/doku.php?id=4rpl:commands:'
            }
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
 * @this {Wiki}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'crpl'|'4rpl'} xrpl
 * @param {string} pageName - The name of the wiki page.
 */
async function getXrpl(m, xrpl, pageName) {
    /** @type {WikiData} */
    let wikidata = {
        title: '',
        cmd: '',
        desc: '',
        fields: /** @type {Discord.EmbedField[]} */([]),
        doesNotExist: false,
    }
    
    //URL of the rpl doc page.
    const url = `${this.rpl[xrpl].urlCmd}${pageName.toLowerCase()}`;
    const data = await HttpRequest.get(url);
    const dom = new JSDOM(data);
    const window = dom.window;
    const document = window.document;

    //Populate wikidata
    processWikiPage.call(this, wikidata, xrpl, pageName, document);

    //Dispose of JSDOM instance
    window.close();

    let emote = ':game_die:';
    await this.bot.sql.transaction(async query => {
        let result = (await query(`SELECT * FROM emotes_game
                                   WHERE guild_id = '${m.guild.id}' AND game = '${this.rpl[xrpl].game}'`)).results[0];
        if(result) emote = result.emote;
    }).catch(logger.error);

    let embed = getEmbedTemplate(xrpl, m.guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''));

    embed.description = '';
    if(wikidata.cmd.length > 0)
        embed.description += `__**[${wikidata.cmd}](${url})**__\n`;
    embed.description += `${wikidata.desc}`;
    embed.fields = wikidata.fields;

    m.message.delete();

    if(wikidata.doesNotExist)
        (await m.message.reply({ embed: embed })).delete({ timeout: 3000 }).catch(logger.error);
    else
        m.message.reply({ embed: embed }).catch(logger.error);
    
}

/**
 * Modifies the wikidata object.
 * @this {Wiki}
 * @param {WikiData} wikidata 
 * @param {'crpl'|'4rpl'} xrpl
 * @param {string} pageName
 * @param {Document} document
 */
function processWikiPage(wikidata, xrpl, pageName, document) {
    if(pageName.length <= 0) {
        wikidata.desc = `__**[${xrpl.toUpperCase()} Documentation](${this.rpl[xrpl].urlDocs})**__`;
        return;
    }

    const elemPageDoesNotExist = document.querySelector('.page > h1');
    if(elemPageDoesNotExist != null && elemPageDoesNotExist.textContent != null && elemPageDoesNotExist.textContent.indexOf('topic does not exist') > -1) {
        wikidata.doesNotExist = true;
        wikidata.desc = 'Command does not exist.';
        return;
    }

    if(xrpl === '4rpl') {
        const elemCmd = document.querySelector('.page > div.level1');
        const elemDesc = document.querySelector('.page > div.level2');

        if(elemCmd != null) wikidata.cmd = (elemCmd.textContent??'').trim().replace(/[\n\r]+/g, ' ');
        if(elemDesc != null) wikidata.desc = shortenDescription.call(this, (elemDesc.textContent??'').trim().replace(/[\n\r]+/g, ' '));
        return;
    }

    if(xrpl === 'crpl') {
        const elemTitle = document.querySelector('.page > h2');
        const elemTable = document.querySelector('.page > div:nth-of-type(1) table');
        const elemDesc = document.querySelector('.page > div:nth-of-type(2)');

        if(elemTable != null) {
            let arr = [[
                elemTable.querySelector('.row0 > .col0'),
                elemTable.querySelector('.row1 > .col0')
            ], [
                elemTable.querySelector('.row0 > .col1'),
                elemTable.querySelector('.row1 > .col1')
            ], [
                elemTable.querySelector('.row0 > .col2'),
                elemTable.querySelector('.row1 > .col2')
            ]]

            for(let obj of arr) {
                let field = {
                    inline: true,
                    name: (obj[0] == null ? 'err0' : obj[0].textContent ?? 'err1').trim(),
                    value: (obj[1] == null ? 'err0' : obj[1].textContent ?? 'err1').trim(),
                }
                //Empty field is not accepted
                if(field.name.length > 0 && field.value.length > 0)
                    wikidata.fields.push(field);
            }
        }
        if(elemDesc != null) {
            let field = {
                inline: false,
                name: 'Description',
                value: shortenDescription.call(this, (elemDesc.textContent??'').trim().replace(/[\n\r]+/g, ' '))
            };

            //Empty field is not accepted
            if(field.value.length > 0)
                wikidata.fields.push(field);
        }
        if(elemTitle != null) wikidata.cmd = elemTitle.textContent??'';
        return;
    }
}


/**
 * @this {Wiki}
 * @param {string} str 
 * @returns {string}
 */
function shortenDescription(str) {
    //Take first this.maxDescLength characters from description.
    let ret = str.substring(0, this.maxDescLength);
    str = str.substring(this.maxDescLength);

    //Reach the end of the last sentence.
    ret += str.substring(0, str.indexOf('.') + 1);
    str = str.substring(0, str.indexOf('.') + 1);

    //If more text is abandoned, add a (...) to signify that.
    if(str.length > 0) ret += ' (...)';

    return ret;
}

/**
 * @this {Wiki}
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