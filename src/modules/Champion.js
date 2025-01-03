'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

/** @typedef {import('../modules/Competition').Db.competition_history_competitions} Db.competition_history_competitions */
/** @typedef {import('../modules/Competition').Db.competition_history_scores} Db.competition_history_scores */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

/**
 * @typedef {object} Db.champion_champions
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} guild_id - Competition channel ID.
 * @property {string} entry_key
 * @property {Discord.Snowflake} user_id
 */

export default class Champion extends Bot.Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS champion_champions (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(64) NOT NULL,
                entry_key VARCHAR(32) NOT NULL,
                user_id VARCHAR(10000) NOT NULL
             )`);
        }).catch(logger.error);

        this.bot.sql.transaction(async query => {
            await query('ALTER TABLE champion_champions MODIFY COLUMN user_id VARCHAR(10000) NOT NULL').catch(() => {});
        }).catch(logger.error);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {Discord.Guild} guild
     * @param {Discord.Collection<Discord.Snowflake, boolean>} champions 
     */
    async refreshCompetitionChampions(query, guild, champions) {
        let arr = [...champions.keys()];

        await query(`DELETE FROM champion_champions WHERE guild_id = '${guild.id}' AND entry_key = 'competition'`);

        for(let snowflake of arr) {
            await query(`INSERT INTO champion_champions (guild_id, entry_key, user_id)
                VALUES ('${guild.id}', 'competition', '${snowflake}')`);
        }

        await processChampionRole.call(this, query, guild);
    }

    /**
     * @param {SQLWrapper.Query} query
     * @param {Discord.Guild} guild
     * @param {{game: string, userId: Discord.Snowflake}[]} champions 
     */
    async refreshExperienceChampions(query, guild, champions) {
        /** @type {{[game: string]: {users: string}}} */
        let champs = {}
        for(let champion of champions) {
            if(champs[champion.game] == null) champs[champion.game] = {users: ''}
            champs[champion.game].users += `${champion.userId}_`
        }
        for(let champ of Object.values(champs)) {
            champ.users = champ.users.substring(0, champ.users.length - 1);
        }

        for(let [game, obj] of Object.entries(champs)) {
            /** @type {Db.champion_champions|null} */
            let resultChampions = (await query(`SELECT * FROM champion_champions 
                WHERE guild_id = '${guild.id}' AND entry_key = 'exp_${game}' FOR UPDATE`)).results[0];
            
            if(resultChampions == null)
                await query(`INSERT INTO champion_champions (guild_id, entry_key, user_id)
                    VALUES ('${guild.id}', 'exp_${game}', '${obj.users}')`);
            else
                await query(`UPDATE champion_champions SET user_id = '${obj.users}'
                    WHERE guild_id = '${guild.id}' AND entry_key = 'exp_${game}'`);
        }

        await processChampionRole.call(this, query, guild);
    }
}

/**
 * @this {Champion}
 * @param {SQLWrapper.Query} query 
 * @param {Discord.Guild} guild
 */
async function processChampionRole(query, guild) {
    const roleId = this.bot.getRoleId(guild.id, "CHAMPION_OF_KC");
    const role = roleId ? guild.roles.cache.get(roleId) : undefined;

    /** @type {Db.champion_champions[]} */
    let resultsChampions = (await query(`SELECT * FROM champion_champions WHERE guild_id = '${guild.id}'`)).results;

    if(role) {
        let arr = [];
        let membersChampions = Array.from(role.members.values());
        for(let member of membersChampions) {
            if(!resultsChampions.find(v => v.user_id.split('_').includes(member.id)))
                arr.push(member.roles.remove(role).catch(logger.error));
        }

        for(let p of arr)
            await p;

        for(let resultChampions of resultsChampions) {
            let snowflakes = resultChampions.user_id.split('_');
            for(let snowflake of snowflakes) {
                if(!membersChampions.find(v => v.id === snowflake)) {
                    let member = await guild.members.fetch(snowflake).catch(() => {});
                    if(member) member.roles.add(role).catch(logger.error);
                }
            }
        }
    }
}