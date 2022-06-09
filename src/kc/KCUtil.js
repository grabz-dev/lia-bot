'use strict';

import Discord from 'discord.js';
import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { mkdir } from 'fs';

const months = ["January", "February", "March", "April", "May", "June",
"July", "August", "September", "October", "November", "December"];
const months_short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const KCUtil = Object.freeze({
    /** @type {Object.<string, number>} */
    gameEmbedColors: Object.freeze({
        cw1: 2929196,
        cw2: 4942335,
        cw3: 5852364,
        pf: 11284267,
        cw4: 6403285
    }),
    embedLimits: Object.freeze({
        fields: 25,
        fieldValue: 1024
    }),
    slashChoices: Object.freeze({
        game: [
            Object.freeze({ name: 'Creeper World 4', value: 'cw4' }),
            Object.freeze({ name: 'Particle Fleet',  value: 'pf' }),
            Object.freeze({ name: 'Creeper World 3', value: 'cw3' }),
            Object.freeze({ name: 'Creeper World 2', value: 'cw2' }),
            Object.freeze({ name: 'Creeper World 1', value: 'cw1' })
        ]
    }),

    /**
     * @param {SlashCommandBuilder|SlashCommandSubcommandBuilder} scb 
     * @returns {any}
     */
    fillScoreSlashCommandChoices: (scb) => {
        return scb.addStringOption(option =>
            option.setName('type')
                .setDescription('Choose the map type to query.')
                .setRequired(true)
                .addChoices(...[
                    { name: 'Custom Map', value: 'custom' },
                    { name: 'CW4 Mark V Map', value: 'cw4_markv' },
                    { name: 'CW4 Chronom Map', value: 'cw4_chronom' },
                    { name: 'CW3 DMD Map', value: 'cw3_dmd' },
                    { name: 'CW2 Code Map', value: 'cw2_code' },
                    { name: 'GUID Map', value: 'gameuid' }
                ])    
        ).addStringOption(option =>
            option.setName('game')
                .setDescription('[Custom, GUID] The game the map is from.')
                .setRequired(false)
                .addChoices(...KCUtil.slashChoices.game)
        ).addIntegerOption(option =>
            option.setName('id')
                .setDescription('[Custom, CW3 DMD] The ID of the map.')
        ).addStringOption(option =>
            option.setName('objective')
                .setDescription('[CW4] The map objective.')
                .addChoices(...[
                    { name: 'Nullify', value: 'nullify' },
                    { name: 'Totems', value: 'totems' },
                    { name: 'Reclaim', value: 'reclaim' },
                    { name: 'Hold', value: 'hold' },
                    { name: 'Collect', value: 'collect' },
                    { name: 'Custom', value: 'custom' },
                ])
        ).addStringOption(option =>
            option.setName('seed')
                .setDescription('[CW4 Mark V, CW2 Code] The map seed.')
        ).addStringOption(option =>
            option.setName('date')
                .setDescription('[Chronom] The map date. e.g. 2022-06-09')
        ).addStringOption(option =>
            option.setName('size')
                .setDescription('[CW2 Code] The map size.')
                .addChoices(...[
                    { name: 'Small', value: '0' },
                    { name: 'Medium', value: '1' },
                    { name: 'Large', value: '2' },
                ])
        ).addStringOption(option =>
            option.setName('complexity')
                .setDescription('[CW2 Code] The map complexity.')
                .addChoices(...[
                    { name: 'Low', value: '0' },
                    { name: 'Medium', value: '1' },
                    { name: 'High', value: '2' },
                ])
        ).addStringOption(option =>
            option.setName('gameuid')
                .setDescription('[GUID] The map GUID.')
        )
    },

    /**
     * Get formatted time elapsed from number of frames
     * @param {number} frames 
     */
    getFormattedTimeFromFrames : function(frames) {
        let time = (Number(frames) / 30);

        let str = [];
        str[0] = (time / 60).toString().split('.')[0];
        str[1] = ((time % 60)).toFixed(2);
        if(Number(str[1]) < 10)
            str[1] = '0' + str[1];
        return str[0] + ':' + str[1];
    },
    /**
     * Get string month from date e.g. January, February
     * @param {Date} date 
     * @param {boolean=} short
     * @param {boolean=} utc
     * @returns {string}
     */
    getMonthFromDate : function(date, short) {
        let month = date.getMonth();
        return short ? months_short[month] : months[month];
    },

    /**
     * Get string day from date e.g. 1st 2nd
     * @param {Date} date 
     * @param {boolean=} utc
     * @returns {string}
     */
    getDayFromDate : function(date) {
        let day = date.getDate();
        let dayStr = `${day}`
        let lastDigit = +dayStr[dayStr.length-1];
        if(day < 4 || day > 20) {
            switch(lastDigit) {
            case 1: return `${day}st`;
            case 2: return `${day}nd`;
            case 3: return `${day}rd`;
            default: return `${day}th`;
            }
        }
        else return `${day}th`;
    },

    /**
     * Convert ArrayBuffer to string
     * @param {ArrayBuffer} buf 
     */
    arrayBufferToString : function(buf) {
        return String.fromCharCode.apply(null, Array.from(new Uint16Array(buf)));
    },

    /**
     * Convert string to ArrayBuffer
     * @param {string} str 
     */
    stringToArrayBuffer : function(str) {
        var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        for (var i=0, strLen=str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    },

    /**
     * @param {any} obj1 
     * @param {any} obj2 
     */
    objectCompareShallow : function (obj1, obj2) {
        if(Object.keys(obj1).length !== Object.keys(obj2).length)
            return false;
        return Object.keys(obj1).every(key => obj2.hasOwnProperty(key) && obj1[key] === obj2[key]);
    },
});