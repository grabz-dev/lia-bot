'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

/** @typedef {import('../modules/Competition').Db.competition_history_competitions} Db.competition_history_competitions */
/** @typedef {import('../modules/Competition').Db.competition_history_maps} Db.competition_history_maps */
/** @typedef {import('../modules/Competition').Db.competition_history_scores} Db.competition_history_scores */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

export default class Champion extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * 
     * @param {Discord.TextChannel} channel
     * @param {Discord.Guild} guild
     * @param {SQLWrapper.Query} query
     * @param {object} opts
     * @param {boolean} opts.postScoreTally
     * @param {boolean} opts.postExpLeaders
     */
    async processChampionRole(channel, guild, query, opts) {
        const roleId = this.bot.getRoleId(guild.id, "CHAMPION_OF_KC");
        const role = roleId ? guild.roles.cache.get(roleId) : undefined;

        /** @type {Discord.Collection<Discord.Snowflake, boolean>} */
        const champions = new Discord.Collection();

        //TODO
        //So the plan was to make it so players who are #1 in Experience leaderboards also get champion
        //So far so good, but this is where I stop for now, because this implementation means that
        //I would have to query competition champions and experience leaderboards for every game
        //every single time someone does `!exp new`, which will be painfully slow. I'll have to
        //come back to this later, for now I'm keeping the code
        await processCompetition.call(this, champions, role??null, channel, guild, query, opts.postScoreTally);
        await processExperience.call(this, champions, role??null, channel, guild, query, opts.postExpLeaders);

        if(role) {
            let arr = [];
            for(let member of role.members.array()) {
                arr.push(member.roles.remove(role).catch(logger.error));
            }
    
            for(let p of arr)
                await p;
    
            for(let champion of champions) {
                let snowflake = champion[0];
    
                let member = await guild.members.fetch(snowflake).catch(() => {});
                if(member) member.roles.add(role).catch(logger.error);
            }
        }
    }
}

/**
 * @this {Champion}
 * @param {Discord.Collection<Discord.Snowflake, boolean>} champions
 * @param {Discord.Role|null} role
 * @param {Discord.TextChannel} channel
 * @param {Discord.Guild} guild
 * @param {SQLWrapper.Query} query
 * @param {boolean} postMessage
 */
async function processExperience(champions, role, channel, guild, query, postMessage) {

}

/**
 * @this {Champion}
 * @param {Discord.Collection<Discord.Snowflake, boolean>} champions
 * @param {Discord.Role|null} role
 * @param {Discord.TextChannel} channel
 * @param {Discord.Guild} guild
 * @param {SQLWrapper.Query} query
 * @param {boolean} postMessage
 */
async function processCompetition(champions, role, channel, guild, query, postMessage) {
    /** @type {Discord.Collection<Discord.Snowflake, number>} */
    const championsWeeks = new Discord.Collection();

    const weeks = 2;
    let i = 1;

    /** @type {Db.competition_history_competitions[]} */
    let resultsComps = (await query(`SELECT * FROM competition_history_competitions WHERE guild_id = '${guild.id}'`)).results;
    
    resultsComps = resultsComps.slice(resultsComps.length - weeks, resultsComps.length);
    
    for(let resultComps of resultsComps) {
        /** @type {Db.competition_history_maps[]} */
        let resultsMaps = (await query(`SELECT * FROM competition_history_maps 
            WHERE id_competition_history_competitions = '${resultComps.id}'`)).results;

        for(let resultMaps of resultsMaps) {
            /** @type {Db.competition_history_scores[]} */
            let resultsScores = (await query(`SELECT * FROM competition_history_scores 
                WHERE id_competition_history_maps = '${resultMaps.id}'`)).results;

            for(let resultScores of resultsScores) {
                if(resultScores.user_rank !== 1) continue;
                
                championsWeeks.set(resultScores.user_id, i);
                champions.set(resultScores.user_id, true);
            }
        }
        i++;
    }

    championsWeeks.sort((a, b) => {
        return b - a;
    });

    if(postMessage) {
        const embed = new Discord.MessageEmbed({
            color: 1482885,
        });
        const field = {
            name: "Current champions",
            value: "",
            inline: false
        }
        for(let champion of championsWeeks) {
            let weeks = champion[1];
            let snowflake = champion[0];

            field.value += `\`${weeks} weeks left\` <@${snowflake}>\n`;
        }
        if(field.value.length === 0) field.value = "None";
        
        embed.fields = [];
        embed.fields.push(field);

        await channel.send({embed: embed});
    }
}