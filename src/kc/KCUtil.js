'use strict';

import Discord from 'discord.js';
import { mkdir } from 'fs';

const months = ["January", "February", "March", "April", "May", "June",
"July", "August", "September", "October", "November", "December"];

export const KCUtil = Object.freeze({
    /** @type {Object.<string, number>} */
    gameEmbedColors: Object.freeze({
        cw2: 4942335,
        cw3: 5852364,
        pf: 11284267,
        cw4: 6403285
    }),
    embedLimits: Object.freeze({
        fields: 25,
        fieldValue: 1024
    }),

    /**
     * Get formatted time elapsed from number of frames
     * @param {number} frames 
     */
    getFormattedTimeFromFrames : function(frames) {
        let time = (Number(frames) / 30);

        let str = [];
        str[0] = (time / 60).toString().split('.')[0];
        str[1] = ((time % 60)).toFixed(1);
        if(Number(str[1]) < 10)
            str[1] = '0' + str[1];
        return str[0] + ':' + str[1];
    },
    /**
     * Floor a date to its month. Does not modify original object.
     * e.g. Nov 14 2020 04:12:45 becomes Nov 01 2020 00:00:00
     * @param {Date} date
     * @returns {Date}
     */
    getDateFlooredToMonth : function(date) {
        date = new Date(date);
        date.setUTCDate(1);
        date.setUTCHours(0);
        date.setUTCMinutes(0);
        date.setUTCSeconds(0);
        date.setUTCMilliseconds(0);
        return date;
    },
    /**
     * Get string month from date e.g. January, February
     * @param {Date} date 
     * @returns {string}
     */
    getMonthFromDate : function(date) {
        return months[date.getUTCMonth()];
    },

    /**
     * Get string day from date e.g. 1st 2nd
     * @param {Date} date 
     * @returns {string}
     */
    getDayFromDate : function(date) {
        let day = date.getUTCDate()+'';
        if(day.endsWith('1')) day += 'st';
        else if(day.endsWith('2')) day += 'nd';
        else if(day.endsWith('3')) day += 'rd';
        else day += 'th';
        return day;
    }
});