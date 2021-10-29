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
 * @property {string} footer
 * @property {Discord.EmbedField[]} fields
 * @property {boolean} doesNotExist
 */

/** 
 * @typedef {object} RPLData
 * @property {string} game
 * @property {string} urlDocs
 * @property {string} urlCmd
 * @property {Object.<string, string>} pageOverrides
 */

export default class Wiki extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        //For page overrides, keys must be lowercase!

        const commonPageOverrides = {
            '$varname:def_val': 'define',
            '$init_var':        'define',
            '$':                'define',
            '<-varname':        'read',
            '<-var':            'read',
            '<-':               'read',
            '->varname':        'write',
            '->var':            'write',
            '->':               'write',
            '-?varname':        'exists',
            '-?var':            'exists',
            '-?':               'exists',
            '--varname':        'delete',
            '--var':            'delete',
            '--':               'delete',
            '<-!':              'refread',
            '->!':              'refwrite',
            '-?!':              'refexists',
            '--!':              'refdelete',
            '@func_name':       'call',
            '@':                'call',
            ':func_name':       'func',
            ':':                'func',
            '#':                'comment',
            ':awake':           'func_awake',
            'awake':            'func_awake',
            ':destroyed':       'func_destroyed',
            'destroyed':        'func_destroyed',
            ':gameloaded':      'func_gameloaded',
            'gameloaded':       'func_gameloaded',
        }

        this.maxDescLength = 200;
        this.rpl = {
            /** @type {RPLData} */
            'crpl': {
                game: 'cw3',
                urlDocs: 'https://knucklecracker.com/wiki/doku.php?id=crpl:crplreference',
                urlCmd: 'https://knucklecracker.com/wiki/doku.php?id=crpl:docs:',
                pageOverrides: Object.assign({
                    ':showmessagedialogcallback':   'func_showmessagedialogcallback',
                    'showmessagedialogcallback':    'func_showmessagedialogcallback',
                    ':usercancelaction':            'func_usercancelaction',
                    'usercancelaction':            'func_usercancelaction',
                }, commonPageOverrides)
            },
            /** @type {RPLData} */
            'prpl': {
                game: 'pf',
                urlDocs: 'https://knucklecracker.com/wiki/doku.php?id=prpl:prplreference',
                urlCmd: 'https://knucklecracker.com/wiki/doku.php?id=prpl:',
                pageOverrides: Object.assign({
                    '<-*':              'readglobal',
                    '->*':              'writeglobal',
                    '-?*':              'existsglobal',
                    '--*':              'deleteglobal',
                    '<-!*':             'refreadglobal',
                    '->!*':             'refwriteglobal',
                    '-?!*':             'refexistsglobal',
                    '--!*':             'refdeleteglobal',
                }, commonPageOverrides)
            },
            /** @type {RPLData} */
            '4rpl': {
                game: 'cw4',
                urlDocs: 'https://knucklecracker.com/wiki/doku.php?id=4rpl:start',
                urlCmd: 'https://knucklecracker.com/wiki/doku.php?id=4rpl:commands:',
                pageOverrides: Object.assign({
                    '$$init_var':       'define2',
                    '$$':               'define2',
                    ':buildcomplete':   'func_buildcomplete',
                    'buildcomplete':    'func_buildcomplete',
                    ':once':            'func_once',
                    'once':             'func_once',
                    ':_selected':       'func_selected',
                    '_selected':        'func_selected',
                    'selected':         'func_selected',
                    ':_uicallback':     'func_uicallback',
                    '_uicallback':      'func_uicallback',
                    'uicallback':       'func_uicallback',
                    ':_warepacketsent': 'func_warepacketsent',
                    '_warepacketsent':  'func_warepacketsent',
                    'warepacketsent':   'func_warepacketsent',
                    'frameadvance':     'MSG_FrameAdvance',
                    'preupdate':        'MSG_PreUpdate',
                    'postupdate':       'MSG_PostUpdate',
                    ',':                'comma',
                }, commonPageOverrides)
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
     * @param {'crpl'|'prpl'|'4rpl'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        switch(ext.action) {
        case 'crpl':
        case 'prpl':
        case '4rpl': {
            let pageName = arg.replace(/[\n\r\s]+/g, '').toLowerCase();
            pageName = this.rpl[ext.action].pageOverrides[pageName]??pageName;

            getXrpl.call(this, m, ext.action, pageName);
        }
        }
    }
}

/**
 * Get XRPL wiki page.
 * @this {Wiki}
 * @param {Bot.Message} m - Message of the user executing the command.
 * @param {'crpl'|'prpl'|'4rpl'} xrpl
 * @param {string} pageName - The name of the wiki page.
 */
async function getXrpl(m, xrpl, pageName) {
    /** @type {WikiData} */
    let wikidata = {
        title: '',
        cmd: '',
        desc: '',
        footer: '',
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

    let embed = getEmbedTemplate.call(this, xrpl, pageName.toLowerCase(), m.guild.emojis.resolve(Bot.Util.getSnowflakeFromDiscordPing(emote||'')||''), m.member);

    embed.description = '';
    if(wikidata.cmd.length > 0)
        embed.description += `__**[${wikidata.cmd}](${url})**__\n`;
    embed.description += `${wikidata.desc}`;
    embed.fields = wikidata.fields;
    if(wikidata.footer.length > 0) embed.footer = {
        text: wikidata.footer
    }

    m.message.delete();

    if(wikidata.doesNotExist) {
        m.channel.send({ embeds: [embed] }).then(message => {
            setTimeout(() => message.delete().catch(logger.error), 3000);
        }).catch(logger.error);
    }
    else {
        m.channel.send({ embeds: [embed] }).catch(logger.error);
    }
    
}

/**
 * Modifies the wikidata object.
 * @this {Wiki}
 * @param {WikiData} wikidata 
 * @param {'crpl'|'prpl'|'4rpl'} xrpl
 * @param {string} pageName
 * @param {Document} document
 */
function processWikiPage(wikidata, xrpl, pageName, document) {
    if(pageName.length <= 0) {
        wikidata.desc = `__**[${xrpl.toUpperCase()} Documentation](${this.rpl[xrpl].urlDocs})**__`;
        wikidata.footer = `Show specific command: !${xrpl} <command>`;
        return;
    }

    const elemPageDoesNotExist = document.querySelector('.page > h1');
    if(elemPageDoesNotExist != null && elemPageDoesNotExist.textContent != null && elemPageDoesNotExist.textContent.indexOf('topic does not exist') > -1) {
        wikidata.doesNotExist = true;
        wikidata.desc = 'Command does not exist.';
        return;
    }

    if(xrpl === '4rpl') {
        //An assumption is made that a div.level1 element always exists, just can contain no text sometimes
        const elemCmd = getNextElement(document.querySelector('#syntax')) ?? document.querySelector('.page > div.level1');
        const elemDesc = getNextElement(document.querySelector('#description'));

        //elemCmd.textContent can contain 1 space sometimes, well we don't want that
        if(elemCmd != null) wikidata.cmd = ((elemCmd.textContent??'').trim()||pageName).replace(/[\n\r]+/g, ' ')
        if(elemDesc != null) wikidata.desc = shortenDescription.call(this, (elemDesc.textContent??'').trim().replace(/[\n\r]+/g, ' '));
        return;
    }

    if(xrpl === 'crpl' || xrpl === 'prpl') {
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
 * @param {'crpl'|'prpl'|'4rpl'} rpl
 * @param {string} name
 * @param {Discord.GuildEmoji|null} emote
 * @param {Discord.GuildMember} initiator
 * @returns {Discord.MessageEmbed}
 */
function getEmbedTemplate(rpl, name, emote, initiator) {
    /** @type {string} */
    return new Discord.MessageEmbed({
        color: KCUtil.gameEmbedColors[this.rpl[rpl].game],
        author: {
            name: `${initiator.nickname ?? initiator.user.username}#${initiator.user.discriminator}`,
            icon_url: initiator.user.avatarURL() ?? initiator.user.defaultAvatarURL
        },
        footer: {
            text: `${rpl.toUpperCase()} • !${rpl} ${name}`,
            icon_url: emote ? emote.url : undefined,
            
        },
        fields: [],
    });
}

/**
 * Get the next element on the provided element's parent
 * @param {Element|null} elem
 * @returns {Element|null} 
 */
function getNextElement(elem) {
    if(elem == null) return null;
    let parent = elem.parentElement;
    if(parent == null) return null;
    let index = Array.from(parent.children).indexOf(elem);
    if(index < 0) return null;
    let nextElem = parent.children[index + 1];
    if(nextElem == null) return null;
    return nextElem;
}