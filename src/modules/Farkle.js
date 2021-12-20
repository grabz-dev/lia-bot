'use strict';
/** @typedef {import('discord-bot-core/src/Core').Entry} Core.Entry */
/** @typedef {import('discord-bot-core/src/structures/SQLWrapper').Query} SQLWrapper.Query */

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;

/**
 * @typedef {object} Db.farkle_servers
 * @property {number=} id
 * @property {Discord.Snowflake} guild_id
 * @property {Discord.Snowflake} user_id
 * @property {Discord.Snowflake} user_id_host
 */

/**
 * @typedef {object} Db.farkle_viewers
 * @property {number=} id
 * @property {Discord.Snowflake} user_id_target
 * @property {Discord.Snowflake} user_id
 * @property {Discord.Snowflake} channel_dm_id
 */

/**
 * @typedef {object} Db.farkle_current_players
 * @property {number=} id
 * @property {number} id_current_games
 * @property {boolean} ready_status
 * @property {number} turn_order
 * @property {Discord.Snowflake} user_id
 * @property {Discord.Snowflake} channel_dm_id
 * @property {number} total_points_banked
 * @property {number} total_points_lost
 * @property {number} total_points_skipped
 * @property {number} total_points_piggybacked_banked
 * @property {number} total_points_piggybacked_lost
 * @property {number} total_points_welfare_gained
 * @property {number} total_points_welfare_lost
 * @property {number} total_rolls
 * @property {number} total_folds
 * @property {number} total_finishes
 * @property {number} total_skips
 * @property {number} total_welfares
 * @property {number} highest_points_banked
 * @property {number} highest_points_lost
 * @property {number} highest_points_skipped
 * @property {number} highest_points_piggybacked_banked
 * @property {number} highest_points_piggybacked_lost
 * @property {number} highest_points_welfare_gained
 * @property {number} highest_points_welfare_lost
 * @property {number} highest_rolls_in_turn
 * @property {number} highest_rolls_in_turn_without_fold
 */

/**
 * @typedef {object} Db.farkle_current_games
 * @property {number=} id
 * @property {Discord.Snowflake} guild_id
 * @property {boolean} has_started
 * @property {number} match_start_time
 * @property {number} points_goal
 * @property {Discord.Snowflake} current_player_user_id
 * @property {string} current_player_rolls
 * @property {number} current_player_points
 * @property {number} current_player_rolls_count
 * @property {number} current_player_points_piggybacked
 * @property {number} opening_turn_point_threshold
 * @property {boolean} high_stakes_variant
 * @property {boolean} current_player_high_stakes_choice
 * @property {boolean} welfare_variant
 */

/**
 * @typedef {object} Db.farkle_history_players
 * @property {number} id
 * @property {number} id_history_games
 * @property {Discord.Snowflake} user_id
 * @property {number} turn_order
 * @property {boolean} has_conceded
 * @property {number} total_points_banked
 * @property {number} total_points_lost
 * @property {number} total_points_skipped
 * @property {number} total_points_piggybacked_banked
 * @property {number} total_points_piggybacked_lost
 * @property {number} total_points_welfare_gained
 * @property {number} total_points_welfare_lost
 * @property {number} total_rolls
 * @property {number} total_folds
 * @property {number} total_finishes
 * @property {number} total_skips
 * @property {number} total_welfares
 * @property {number} highest_points_banked
 * @property {number} highest_points_lost
 * @property {number} highest_points_skipped
 * @property {number} highest_points_piggybacked_banked
 * @property {number} highest_points_piggybacked_lost
 * @property {number} highest_points_welfare_gained
 * @property {number} highest_points_welfare_lost
 * @property {number} highest_rolls_in_turn
 * @property {number} highest_rolls_in_turn_without_fold
 */

/**
 * @typedef {object} Db.farkle_history_games
 * @property {number} id
 * @property {Discord.Snowflake} guild_id
 * @property {number} match_start_time
 * @property {number} match_end_time
 * @property {number} points_goal
 * @property {Discord.Snowflake} user_id_winner
 * @property {number} opening_turn_point_threshold
 * @property {boolean} high_stakes_variant
 * @property {boolean} welfare_variant
 */

/**
 * @typedef {object} Db.farkle_users
 * @property {number=} id
 * @property {Discord.Snowflake} user_id
 * @property {string} skin
 */

/** @typedef {"ready"|"reject"|"keep"|"finish"|"help"|"hurry"|"concede"|"new"|"continue"} ActionType */
/** @typedef {"fold"|"welfare"} GameType */

const MAX_DICE = 6;

const F = Object.freeze({
    matches: Object.freeze([
        { m: [1, 2, 3, 4, 5, 6],    p: 1500 },
        { m: [2, 3, 4, 5, 6],       p: 750  },
        { m: [1, 2, 3, 4, 5],       p: 500  },
        { m: [1, 1, 1, 1, 1, 1],    p: 8000 },
        { m: [1, 1, 1, 1, 1],       p: 4000 },
        { m: [1, 1, 1, 1],          p: 2000 },
        { m: [1, 1, 1],             p: 1000 },
        { m: [5, 5, 5, 5, 5, 5],    p: 4000 },
        { m: [5, 5, 5, 5, 5],       p: 2000 },
        { m: [5, 5, 5, 5],          p: 1000 },
        { m: [5, 5, 5],             p: 500 },
        { m: [6, 6, 6, 6, 6, 6],    p: 4800 },
        { m: [6, 6, 6, 6, 6],       p: 2400 },
        { m: [6, 6, 6, 6],          p: 1200 },
        { m: [6, 6, 6],             p: 600 },
        { m: [4, 4, 4, 4, 4, 4],    p: 3200 },
        { m: [4, 4, 4, 4, 4],       p: 1600 },
        { m: [4, 4, 4, 4],          p: 800  },
        { m: [4, 4, 4],             p: 400  },
        { m: [3, 3, 3, 3, 3, 3],    p: 2400 },
        { m: [3, 3, 3, 3, 3],       p: 1200 },
        { m: [3, 3, 3, 3],          p: 600  },
        { m: [3, 3, 3],             p: 300  },
        { m: [2, 2, 2, 2, 2, 2],    p: 1600 },
        { m: [2, 2, 2, 2, 2],       p: 800 },
        { m: [2, 2, 2, 2],          p: 400 },
        { m: [2, 2, 2],             p: 200 },
        { m: [1],                   p: 100 },
        { m: [5],                   p: 50  },
    ]),
    colors: Object.freeze([
        0,         
        11460749,
        7911119,
        13016423,
        12084573,
        6512567,
        6075827,
        12693569,
        11881878,
        9718194,
        1151377
    ]),
    /** @type {Object.<string, Object.<number, string>>} */
    skins: Object.freeze({
        braille: {
            1: "⡀",
            2: "⣀",
            3: "⣄",
            4: "⣤",
            5: "⣦",
            6: "⣶"
        },
        keycaps: {
            1: "1️⃣",
            2: "2️⃣",
            3: "3️⃣",
            4: "4️⃣",
            5: "5️⃣",
            6: "6️⃣"
        },
        dice: {
            1: "⚀",
            2: "⚁",
            3: "⚂",
            4: "⚃",
            5: "⚄",
            6: "⚅"
        },
        digits: {
            1: "1",
            2: "2",
            3: "3",
            4: "4",
            5: "5",
            6: "6"
        },
        chinese: {
            1: "一",
            2: "二",
            3: "三",
            4: "四",
            5: "五",
            6: "六"
        }
    }),
    currency: "\💎", //₿ ƒ
    startingCurrency: 1
});



export default class Farkle extends Bot.Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);

        /** @type {null|{guildId: Discord.Snowflake, farkleChannelId: Discord.Snowflake, botCommandsChannelId?: Discord.Snowflake}} */
        this.ServerDefs = null;

        /** @type {Discord.Message[]} */
        this.queue = [];
        this.queueRunning = false;
    }
    
    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS farkle_current_players (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, id_current_games BIGINT UNSIGNED NOT NULL, ready_status BOOLEAN NOT NULL, turn_order SMALLINT NOT NULL, user_id TINYTEXT NOT NULL, channel_dm_id TINYTEXT NOT NULL, total_points_banked SMALLINT UNSIGNED NOT NULL, total_points_lost SMALLINT UNSIGNED NOT NULL, total_points_skipped SMALLINT UNSIGNED NOT NULL, total_points_piggybacked_banked SMALLINT UNSIGNED NOT NULL, total_points_piggybacked_lost SMALLINT UNSIGNED NOT NULL, total_points_welfare_gained SMALLINT UNSIGNED NOT NULL, total_points_welfare_lost SMALLINT UNSIGNED NOT NULL, total_rolls INT UNSIGNED NOT NULL, total_folds INT UNSIGNED NOT NULL, total_finishes INT UNSIGNED NOT NULL, total_skips INT UNSIGNED NOT NULL, total_welfares INT UNSIGNED NOT NULL, highest_points_banked SMALLINT UNSIGNED NOT NULL, highest_points_lost SMALLINT UNSIGNED NOT NULL, highest_points_skipped SMALLINT UNSIGNED NOT NULL, highest_points_piggybacked_banked SMALLINT UNSIGNED NOT NULL, highest_points_piggybacked_lost SMALLINT UNSIGNED NOT NULL, highest_points_welfare_gained SMALLINT UNSIGNED NOT NULL, highest_points_welfare_lost SMALLINT UNSIGNED NOT NULL, highest_rolls_in_turn INT UNSIGNED NOT NULL, highest_rolls_in_turn_without_fold INT UNSIGNED NOT NULL);`);
            await query(`CREATE TABLE IF NOT EXISTS farkle_current_games (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id TINYTEXT NOT NULL, has_started BOOLEAN NOT NULL, match_start_time BIGINT NOT NULL, points_goal SMALLINT UNSIGNED NOT NULL, current_player_user_id TINYTEXT NOT NULL, current_player_rolls TINYTEXT NOT NULL, current_player_points SMALLINT UNSIGNED NOT NULL, current_player_rolls_count INT UNSIGNED NOT NULL, current_player_points_piggybacked INT UNSIGNED NOT NULL, opening_turn_point_threshold SMALLINT UNSIGNED NOT NULL, high_stakes_variant BOOLEAN NOT NULL, current_player_high_stakes_choice BOOLEAN NOT NULL, welfare_variant BOOLEAN NOT NULL);`);
        
            await query(`CREATE TABLE IF NOT EXISTS farkle_history_players (id BIGINT UNSIGNED PRIMARY KEY, id_history_games BIGINT UNSIGNED NOT NULL, user_id TINYTEXT NOT NULL, turn_order SMALLINT NOT NULL, has_conceded BOOLEAN NOT NULL, total_points_banked SMALLINT UNSIGNED NOT NULL, total_points_lost SMALLINT UNSIGNED NOT NULL, total_points_skipped SMALLINT UNSIGNED NOT NULL, total_points_piggybacked_banked SMALLINT UNSIGNED NOT NULL, total_points_piggybacked_lost SMALLINT UNSIGNED NOT NULL, total_points_welfare_gained SMALLINT UNSIGNED NOT NULL, total_points_welfare_lost SMALLINT UNSIGNED NOT NULL, total_rolls INT UNSIGNED NOT NULL, total_folds INT UNSIGNED NOT NULL, total_finishes INT UNSIGNED NOT NULL, total_skips INT UNSIGNED NOT NULL, total_welfares INT UNSIGNED NOT NULL, highest_points_banked SMALLINT UNSIGNED NOT NULL, highest_points_lost SMALLINT UNSIGNED NOT NULL, highest_points_skipped SMALLINT UNSIGNED NOT NULL, highest_points_piggybacked_banked SMALLINT UNSIGNED NOT NULL, highest_points_piggybacked_lost SMALLINT UNSIGNED NOT NULL, highest_points_welfare_gained SMALLINT UNSIGNED NOT NULL, highest_points_welfare_lost SMALLINT UNSIGNED NOT NULL, highest_rolls_in_turn INT UNSIGNED NOT NULL, highest_rolls_in_turn_without_fold INT UNSIGNED NOT NULL);`);
            await query(`CREATE TABLE IF NOT EXISTS farkle_history_games (id BIGINT UNSIGNED PRIMARY KEY, guild_id TINYTEXT NOT NULL, match_start_time BIGINT NOT NULL, match_end_time BIGINT NOT NULL, points_goal SMALLINT UNSIGNED NOT NULL, user_id_winner TINYTEXT NOT NULL, opening_turn_point_threshold SMALLINT UNSIGNED NOT NULL, high_stakes_variant BOOLEAN NOT NULL, welfare_variant BOOLEAN NOT NULL);`);
        
            await query(`CREATE TABLE IF NOT EXISTS farkle_servers (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id TINYTEXT NOT NULL, user_id TINYTEXT NOT NULL, user_id_host TINYTEXT NOT NULL)`)
            await query(`CREATE TABLE IF NOT EXISTS farkle_users (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id TINYTEXT NOT NULL, skin TINYTEXT NOT NULL)`);
            await query(`CREATE TABLE IF NOT EXISTS farkle_viewers (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id_target TINYTEXT NOT NULL, user_id TINYTEXT NOT NULL, channel_dm_id TINYTEXT NOT NULL)`);

            /** @type {Db.farkle_current_players[]} */
            var docCPs = (await query(`SELECT * FROM farkle_current_players cp JOIN farkle_current_games cg ON cp.id_current_games = cg.id WHERE cg.guild_id = ${guild.id}`)).results;

            /** @type {Db.farkle_viewers[]} */
            var docVs = (await query(`SELECT v.id, v.user_id_target, v.user_id, v.channel_dm_id FROM farkle_viewers v JOIN farkle_current_players cp ON v.user_id_target = cp.user_id JOIN farkle_current_games cg ON cp.id_current_games = cg.id WHERE cg.guild_id = ${guild.id}`)).results;

            /** @type {(Db.farkle_current_players|Db.farkle_viewers)[]} */
            var docCPVs = [];
            docCPVs = docCPVs.concat(docCPs, docVs);

            for(let attendee of docCPVs) {
                let member = await guild.members.fetch(attendee.user_id);
                if(!member) return; //TODO
                await member.createDM();
            }
        }).catch(logger.error);
    }

    /** @param {Discord.Message} message - The message that was sent. */
    onMessage(message) {
        if(message.member == null || message.guild == null) return;
        if(this.ServerDefs == null) return;
        if(message.guild.id === this.ServerDefs.guildId && message.channel.id !== this.ServerDefs.farkleChannelId) return;

        const member = message.member;

        var prep = this.cache.get("0", `prep${member.id}`);
        if(!prep) return;
        if(message.member.id !== prep.host.id) return;
        
        let arg = message.content;
        if(arg.indexOf("cancel") > -1) {
            message.channel.send("Match cancelled.").catch(logger.error);
            
            for(let i = 0; i < prep.members.length; i++) {
                this.cache.set("0", `prep${prep.members[i].id}`, undefined);
            }
            
            return;
        }

        const highStakes = (() => {
            if(arg.indexOf('hs') > -1) {
                arg = arg.split('hs').join('');
                return true;
            }
            return false;
        })();
        const welfare = (() => {
            if(arg.indexOf('wf') > -1) {
                arg = arg.split('wf').join('');
                return true;
            }
            return false;
        })();
        const args = arg.split(',');
        const aobj = {
            goal: +[args[0].trim()],
            threshold: +[args[1]?.trim()]
        }
        if(aobj.threshold == null) aobj.threshold = 0;

        if(!Number.isFinite(aobj.goal)) {
            message.channel.send("The specified point goal is invalid.").catch(logger.error);
            return;
        }

        aobj.goal = Math.ceil(aobj.goal / 50) * 50;
        if(aobj.goal < 1000 || aobj.goal > 10000) {
            message.channel.send("Point goal must be between 1000 and 10000.").catch(logger.error);
            return;
        }

        if(!Number.isFinite(aobj.threshold)) {
            message.channel.send("The specified opening turn point threshold is invalid.").catch(logger.error);
            return;
        }

        aobj.threshold = Math.ceil(aobj.threshold / 50) * 50;
        if(aobj.threshold !== 0 && aobj.threshold < 350 || aobj.threshold > 1000) {
            message.channel.send("Opening turn point threshold must be between 350 and 1000.").catch(logger.error);
            return;
        }

        this.bot.sql.transaction(async query => {
            /** @type {Db.farkle_current_players[]} */
            var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${member.id}`)).results;
            if(docCPs.length > 0) return;

            /** @type {Db.farkle_current_games} */
            const game = {
                guild_id: prep.guild.id,
                has_started: false,
                match_start_time: 0,
                points_goal: aobj.goal,
                current_player_user_id: "",
                current_player_points: 0,
                current_player_points_piggybacked: 0,
                current_player_rolls: "[]",
                current_player_rolls_count: 0,
                opening_turn_point_threshold: aobj.threshold,
                high_stakes_variant: highStakes,
                current_player_high_stakes_choice: false,
                welfare_variant: welfare
            }

            var doc = (await query(Bot.Util.SQL.getInsert(game, "farkle_current_games") + "; SELECT LAST_INSERT_ID();")).results[1][0];
            game.id = Object.values(doc)[0];

            for(let i = 0; i < prep.members.length; i++) {
                /** @type {Db.farkle_current_players[]} */
                var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${prep.members[i].id}`)).results;
                if(docCPs.length > 0) continue;

                var embed = getEmbedBlank();
                if(i === 0)
                    embed.description = `Waiting for everyone to be ready.`;
                else
                    embed.description = `${prep.members[0]} invited you to play Farkle!`;

                embed.description += `\n  • Point goal: ${aobj.goal}`;
                if(aobj.threshold > 0) embed.description += `\n  • Opening turn point threshold: ${aobj.threshold}`;
                if(highStakes) embed.description += `\n  • **High Stakes**`;
                if(welfare) embed.description += `\n  • **Welfare**`;
                embed.description += `\n  • Players: ${prep.members.join(", ")}\n`;
                embed.description += `\nType \`ready\` or \`r\` if you want to play.\nType \`reject\` to cancel the match.`;
                
                await prep.channels[i].send({ embeds: [embed] });

                /** @type {Db.farkle_current_players} */
                const player = {
                    id_current_games: /** @type {number} */(game.id),
                    ready_status: false,
                    turn_order: 0,
                    user_id: prep.members[i].id,
                    channel_dm_id: prep.channels[i].id,
                    total_points_banked: 0,
                    total_points_lost: 0,
                    total_points_skipped: 0,
                    total_points_piggybacked_banked: 0,
                    total_points_piggybacked_lost: 0,
                    total_points_welfare_gained: 0,
                    total_points_welfare_lost: 0,
                    total_rolls: 0,
                    total_folds: 0,
                    total_finishes: 0,
                    total_skips: 0,
                    total_welfares: 0,
                    highest_points_banked: 0,
                    highest_points_lost: 0,
                    highest_points_skipped: 0,
                    highest_points_piggybacked_banked: 0,
                    highest_points_piggybacked_lost: 0,
                    highest_points_welfare_gained: 0,
                    highest_points_welfare_lost: 0,
                    highest_rolls_in_turn: 0,
                    highest_rolls_in_turn_without_fold: 0,
                }
                
                await query(Bot.Util.SQL.getInsert(player, "farkle_current_players"));
            }

            for(let i = 0; i < prep.members.length; i++) {
                this.cache.set("0", `prep${prep.members[i].id}`, undefined);
            }
        }).catch(logger.error); 
    }

    //TODO I believe I can safely remove the queue system if I use locking with FOR UPDATE
    //and change database type from REPEATABLE READ to READ COMMITTED
    //but not many people play this and I don't have enough testing accounts
    //so I'm leaving it as-is for now.

    /** @param {Discord.Message} message - The message that was sent. */
    onMessageDM(message) {
        //Ensure order of play
        this.queue.push(message);
        if(this.queueRunning) return;
        this.queueRunning = true;

        (async () => {
            while(this.queue.length > 0) {
                let qitem = this.queue[0];
                this.queue.splice(0, 1);
                await this.play(qitem);
            }
            this.queueRunning = false;
        })();
    }

    /**
     * 
     * @param {Discord.Message} message 
     * @returns 
     */
    async play(message) {
        const user = message.author;
        const msg = message.content.toLowerCase();

        let antilag = this.cache.get("0", `antilag${user.id}`);
        if(antilag && Date.now() - antilag < 500) {
            return;
        }
        this.cache.set("0", `antilag${user.id}`, Date.now());
        
        /** @type {""|ActionType|GameType} */
        let type = "";
        type = msg === "r" ? "ready" : type;
        type = msg.indexOf("k") > -1 ? "keep" : type;
        type = msg.indexOf("f") > -1 ? "finish" : type;
        type = msg.indexOf("n") > -1 ? "new" : type;
        type = msg.indexOf("c") > -1 ? "continue" : type;
        type = msg.indexOf("ready") > -1 ? "ready" : type;
        type = msg.indexOf("reject") > -1 ? "reject" : type;
        type = msg.indexOf("keep") > -1 ? "keep" : type;
        type = msg.indexOf("finish") > -1 ? "finish" : type;
        type = msg.indexOf("new") > -1 ? "new" : type;
        type = msg.indexOf("continue") > -1 ? "continue" : type;
        type = msg.indexOf("help") > -1 ? "help" : type;
        type = msg.indexOf("hurry") > -1 ? "hurry" : type;
        type = msg.indexOf("concede") > -1 ? "concede" : type;
        if(type === "") return;

        /** @type { { type: ActionType, updateCurrentMatch: boolean, gameEnded: boolean } } */
        const state = {
            type: type,
            updateCurrentMatch: false,
            gameEnded: false,
        }

        await this.bot.sql.transaction(async query => {
            /** @type {Db.farkle_current_players|undefined} */
            var _docCP = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${user.id}`)).results[0];
            if(!_docCP) return;

            /** @type {Db.farkle_current_players[]} */
            var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE id_current_games = ${_docCP.id_current_games}`)).results;
            var _docCP = docCPs.find(v => v.user_id === user.id);
            if(!_docCP) return;

            var docCP = _docCP;

            /** @type {Db.farkle_current_games} */
            var docCG = (await query(`SELECT * FROM farkle_current_games WHERE id = ${docCP.id_current_games}`)).results[0];
            if(!docCG) return;

            /** @type {Db.farkle_viewers[]} */
            var docVs = (await query(`SELECT v.id, v.user_id_target, v.user_id, v.channel_dm_id FROM farkle_viewers v JOIN farkle_current_players cp ON v.user_id_target = cp.user_id WHERE cp.id_current_games = ${docCG.id}`)).results;

            /** @type {(Db.farkle_current_players|Db.farkle_viewers)[]} */
            var docCPVs = [];
            docCPVs = docCPVs.concat(docCPs, docVs);

            if(type === "help") {
                if(docCG.current_player_user_id.length === 0)
                    return;

                var embed = getEmbedBlank();

                if(docCP.user_id === docCG.current_player_user_id)
                    embed.description = `Both \`keep\` and \`finish\` are used to set aside one or more scoring dice. The difference is that \`keep\` will continue your turn, leaving you vulnerable to a farkle if the remaining dice do not produce any scoring dice. \`finish\` will bank your points and end your turn.\nExample usage: \`keep 111\`, \`finish 51\`, \`f12345\`, \`k1\`, \`k444\``;
                else
                    embed.description = "\nType \`hurry\` to put the current player on a 90 second timer until their next action, or they will lose their turn.";

                embed.description += "\nType \`concede\` to drop out of the match.";

                await message.channel.send({ embeds: [embed] });
                return;
            }
            else if(type === "hurry") {
                if(this.cache.get("0", `hurry${docCG.id}`) != null)
                    return;
                if(docCG.current_player_user_id.length === 0)
                    return;
                if(docCP.user_id === docCG.current_player_user_id)
                    return;
                
                for(let attendee of docCPVs) {
                    let embed = getEmbedBlank();
                    embed.description = `<@${docCP.user_id}> wants to hurry. <@${docCG.current_player_user_id}> has 90 seconds to make a move.`;
                    await (await (await user.client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] });
                }

                var timeout = setTimeout(() => {
                    this.bot.sql.transaction(async query => {
                        let playerCurrent = docCPs.find(v=>v.user_id===docCG.current_player_user_id);
                        if(!playerCurrent) {
                            this.cache.set("0", `hurry${docCG.id}`, undefined);
                            return;
                        }
                        playerCurrent.total_skips++;
                        playerCurrent.total_points_skipped += docCG.current_player_points;
                        if(docCG.current_player_points > playerCurrent.highest_points_skipped)
                            playerCurrent.highest_points_skipped = docCG.current_player_points;
                        
                        let player = docCG.current_player_user_id;
                        await turn.bind(this)(message.client, docCG, docCPs, query, "hurry");
                        await roll.bind(this)(message.client, { type: "hurry", keep: [], points: docCG.current_player_points, player: player }, docCG, docCPs, docCPVs, query);

                        /** @type { { type: "ready"|"reject"|"keep"|"finish"|"help"|"hurry"|"concede", updateCurrentMatch: boolean, gameEnded: boolean } } */
                        let state = {
                            type: "hurry",
                            updateCurrentMatch: true,
                            gameEnded: false
                        }
                        await commit.bind(this)(state, docCG, docCP, docCPs, query, message.client);
                        this.cache.set("0", `hurry${docCG.id}`, undefined);
                    }).catch(logger.error);
                }, 1000*90);

                this.cache.set("0", `hurry${docCG.id}`, {
                    timeout: timeout
                });
                return;
            }
            else if(type === "ready") {
                if(docCG.current_player_user_id.length > 0)
                    return;

                if(!docCP.ready_status) {
                    for(let attendee of docCPVs) {
                        let embed = getEmbedBlank();
                        embed.description = `${user} is ready to play!`;
                        await (await (await user.client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] })
                    }

                    docCP.ready_status = true;
                    await query(`UPDATE farkle_current_players SET ready_status = ${docCP.ready_status} WHERE user_id = ${docCP.user_id}`);
                }

                let ready = !docCPs.some(v=>!v.ready_status);
                if(!ready) return;

                let embed = getEmbedBlank();
                embed.description = `Everyone is ready, and the game begins!\n\n`;
                for(let attendee of docCPVs) {
                    await (await (await user.client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] })
                }

                await Bot.Util.Promise.sleep(2500);

                await decide.bind(this)(message.client, docCG, docCP, docCPs, docCPVs);
                await roll.bind(this)(message.client, { type: null, keep: [], points: 0, player: "" }, docCG, docCPs, docCPVs, query);
                state.updateCurrentMatch = true;
            }
            else if(type === "concede") {
                if(docCG.current_player_user_id.length === 0)
                    return;
                
                for(let attendee of docCPVs) {
                    let embed = getEmbedBlank();
                    embed.description = `<@${docCP.user_id}> has conceded the match.`;
                    await (await (await user.client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] });
                }

                if(docCPs.length === 2) {
                    if(docCP.user_id === docCG.current_player_user_id) {
                        await turn.bind(this)(message.client, docCG, docCPs, query, "concede");
                    }
                    await end.bind(this)(message.client, { type: "concede", keep: [], points: 0, player: docCP.user_id }, docCG, docVs, docCPs, query, "concede");
                    state.gameEnded = true;
                }
                else {
                    if(docCP.user_id === docCG.current_player_user_id) {
                        let player = docCG.current_player_user_id;
                        await turn.bind(this)(message.client, docCG, docCPs, query, "concede");
                        await roll.bind(this)(message.client, { type: "concede", keep: [], points: 0, player: player }, docCG, docCPs, docCPVs, query);
                        state.updateCurrentMatch = true;
                    }
                    
                    let to = docCP.turn_order;
                    while(true) {
                        to++;
                        /** @type {Db.farkle_current_players|undefined} */
                        let player = docCPs.find(v => v.turn_order === to);
                        if(!player) break;
                        player.turn_order--;
                    }
                }
            }
            else if(type === "reject") {
                if(docCG.current_player_user_id.length > 0)
                    return;

                for(let attendee of docCPVs) {
                    let embed = getEmbedBlank();
                    embed.description = `<@${user.id}> does not want to play. Match cancelled.`;
                    await (await (await user.client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] });
                }
            }
            else if(type === "keep" || type === "finish" || type === "continue" || type === "new") {
                if(docCG.current_player_user_id.length === 0)
                    return;
                if(docCG.current_player_user_id !== docCP.user_id) {
                    await (await (await user.client.users.fetch(docCP.user_id))?.createDM()).send(`It's not your turn yet! Waiting on <@${docCG.current_player_user_id}>.`);
                    return;
                }

                if(type === "keep" || type === "finish") {
                    if(docCG.current_player_high_stakes_choice)
                        return;

                    var temp = msg.replace(/[^0-9]/g, "").split("");
                    /** @type {number[]} */
                    let keep = [];
                    for(let i = 0; i < temp.length; i++) {
                        let number = Math.floor(Number(temp[i]));
                        if(!Number.isNaN(number) && number >= 1 && number <= 6)
                            keep.push(number);
                    }

                    if(!getValidKeep(JSON.parse(docCG.current_player_rolls), keep)) {
                        await (await (await user.client.users.fetch(docCP.user_id))?.createDM()).send("Selected dice must match the rolls!");
                        return;
                    }

                    let rolls = JSON.parse(docCG.current_player_rolls);
                    let points = processFarkleKeep(rolls, [...keep]);
                    docCG.current_player_rolls = JSON.stringify(rolls);

                    if(points === 0) {
                        await (await (await user.client.users.fetch(docCP.user_id))?.createDM()).send("This keep is invalid.");
                        return;
                    }

                    let totalPoints = points + docCG.current_player_points;
                    if(type === "finish" && docCP.total_points_banked === 0 && totalPoints < docCG.opening_turn_point_threshold) {
                        await (await (await user.client.users.fetch(docCP.user_id))?.createDM()).send(`You cannot finish your opening turn with less than ${docCG.opening_turn_point_threshold} points. This finish would bank ${totalPoints}.`);
                        return;
                    }

                    let hurry = this.cache.get("0", `hurry${docCG.id}`);
                    if(hurry) {
                        clearTimeout(hurry.timeout);
                        this.cache.set("0", `hurry${docCG.id}`, undefined);
                    }

                    if(docCG.welfare_variant && totalPoints + docCP.total_points_banked > docCG.points_goal) {
                        docCP.total_welfares++;
                        state.updateCurrentMatch = true;

                        let currentPlayer = docCG.current_player_user_id;
                        await welfare.bind(this)(message.client, { type: type, keep: keep, points: points, player: currentPlayer }, docCG, docCPs, docCPVs, query);
                        type = "welfare";

                        let lowestBankedPointsCurrently = docCPs.reduce((acc, loc) => acc < loc.total_points_banked ? acc : loc.total_points_banked, Infinity);
                        //Furthest in turn order
                        let leastPointsPlayer = (() => {
                            //players sorted descending
                            let d = docCPs.slice().sort((a, b) => b.turn_order - a.turn_order);
                            //rotate array so that it is sorted from players furthest to closest in turn order, with current player being first
                            d.unshift.apply(d, d.splice(d.findIndex(v => v.turn_order === docCP.turn_order), d.length));
                            //find the nearest player in the array which has the lowest points banked
                            d.splice(0, 1);
                            return d.find(v => v.total_points_banked === lowestBankedPointsCurrently);
                        })();

                        //only give out welfare points if the player with the least amount of points is not the current player
                        if(leastPointsPlayer != null) {
                            leastPointsPlayer.total_points_banked += totalPoints;
                            leastPointsPlayer.total_points_welfare_gained += totalPoints;
                            docCP.total_points_welfare_lost += totalPoints;
                            if(totalPoints > leastPointsPlayer.highest_points_welfare_gained)
                                leastPointsPlayer.highest_points_welfare_gained = totalPoints;
                            if(totalPoints > docCP.highest_points_welfare_lost)
                                docCP.highest_points_welfare_lost = totalPoints;

                            if(leastPointsPlayer.total_points_banked >= docCG.points_goal) {
                                while(leastPointsPlayer.user_id !== docCG.current_player_user_id) await turn.bind(this)(message.client, docCG, docCPs, query, "welfare");
                                await end.bind(this)(message.client, { type: "welfare", keep: keep, points: totalPoints, bank: leastPointsPlayer.total_points_banked, player: currentPlayer, targetPlayer: leastPointsPlayer.user_id }, docCG, docVs, docCPs, query, "no_concede");
                                state.gameEnded = true;
                                await commit.bind(this)(state, docCG, docCP, docCPs, query, message.client);
                                return;
                            }
                        }
                        
                        await turn.bind(this)(message.client, docCG, docCPs, query, "welfare");
                        await roll.bind(this)(message.client, { type: "welfare", keep: keep, points: totalPoints, bank: leastPointsPlayer == null ? 0 : leastPointsPlayer.total_points_banked, player: currentPlayer, targetPlayer: leastPointsPlayer == null ? undefined: leastPointsPlayer.user_id }, docCG, docCPs, docCPVs, query);
                        await commit.bind(this)(state, docCG, docCP, docCPs, query, message.client);
                        return;
                    }
                    //welfare return ends here

                    docCG.current_player_points += points;

                    if(type === "keep") {
                        let player = docCG.current_player_user_id;
                        await roll.bind(this)(message.client, { type: "keep", keep: keep, points: points, player: player }, docCG, docCPs, docCPVs, query);
                        state.updateCurrentMatch = true;
                    }
                    else if(type === "finish") {
                        docCP.total_points_banked += docCG.current_player_points;
                        docCP.total_points_piggybacked_banked += docCG.current_player_points_piggybacked;
                        if(docCG.current_player_points > docCP.highest_points_banked)
                            docCP.highest_points_banked = docCG.current_player_points;
                        if(docCG.current_player_points_piggybacked > docCP.highest_points_piggybacked_banked)
                            docCP.highest_points_piggybacked_banked = docCG.current_player_points_piggybacked;
                        docCP.total_finishes++;

                        if(docCG.current_player_rolls_count > docCP.highest_rolls_in_turn_without_fold)
                            docCP.highest_rolls_in_turn_without_fold = docCG.current_player_rolls_count;

                        let player = docCG.current_player_user_id;
                        let points = docCG.current_player_points;
                        let bank = docCP.total_points_banked;
                        if(docCP.total_points_banked >= docCG.points_goal) {
                            await end.bind(this)(message.client, { type: "finish", keep: keep, points: points, bank: bank, player: player }, docCG, docVs, docCPs, query, "no_concede");
                            state.gameEnded = true;
                            state.updateCurrentMatch = true;
                        }
                        else {
                            await turn.bind(this)(message.client, docCG, docCPs, query, "finish");
                            if(docCG.high_stakes_variant)
                                await highstakes.bind(this)(message.client, { type: "finish", keep: keep, points: points, bank: bank, player: player }, docCG, docCPs, docCPVs, query);
                            else
                                await roll.bind(this)(message.client, { type: "finish", keep: keep, points: points, bank: bank, player: player }, docCG, docCPs, docCPVs, query);
                            state.updateCurrentMatch = true;
                        }
                    }
                }
                else if(type === "new" || type === "continue") {
                    if(!docCG.current_player_high_stakes_choice)
                        return;

                    docCG.current_player_high_stakes_choice = false;

                    if(type === "new") {
                        docCG.current_player_points = 0;
                        docCG.current_player_rolls = "[]";
                    }
                    else if(type === "continue") {
                        docCG.current_player_points_piggybacked = docCG.current_player_points;
                    }

                    await roll.bind(this)(message.client, { type: type, keep: [], points: docCG.current_player_points, bank: docCP.total_points_banked, player: docCG.current_player_user_id }, docCG, docCPs, docCPVs, query);
                    state.updateCurrentMatch = true;
                }
            }

            await commit.bind(this)(state, docCG, docCP, docCPs, query, message.client);
        }).catch(logger.error);
    }

    /**
     * Module Function
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext
     * @param {'host'|'leave'|'join'|'start'|'skin'|'games'|'profile'|'spectate'|'rules'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        if(this.ServerDefs == null) return;

        switch(ext.action) {
            case 'host':
            case 'leave':
            case 'join':
            case 'start':
            case 'spectate': {
                if(m.guild.id === this.ServerDefs.guildId && m.channel.id !== this.ServerDefs.farkleChannelId) {
                    m.channel.send(`You can only use this command in the <#${this.ServerDefs.farkleChannelId}> channel.`).then(message => {
                        setTimeout(() => { message.delete(); m.message.delete(); }, 10000);
                    }).catch(logger.error);
                    return;
                }
            }
            case 'skin':
            case 'games':
            case 'profile':
            case 'rules': {
                if(m.guild.id === this.ServerDefs.guildId && (m.channel.id !== this.ServerDefs.farkleChannelId && m.channel.id !== this.ServerDefs.botCommandsChannelId)) {
                    m.channel.send(`You can only use this command in ${this.ServerDefs.botCommandsChannelId == null ? '' : `either the <#${this.ServerDefs.botCommandsChannelId}> channel, or `}the <#${this.ServerDefs.farkleChannelId}> channel.`).then(message => {
                        setTimeout(() => { message.delete(); m.message.delete(); }, 10000);
                    }).catch(logger.error);
                    return;
                }
            }
        }

        switch(ext.action) {
            case 'host':
                this.host(m, args, arg, ext);
                break;
            case 'leave':
                this.leave(m, args, arg, ext);
                break;
            case 'join':
                this.join(m, args, arg, ext);
                break;
            case 'start':
                this.start(m, args, arg, ext);
                break;
            case 'spectate':
                this.spectate(m, args, arg, ext);
                break;
            case 'skin':
                this.skin(m, args, arg, ext);
                break;
            case 'games':
                this.games(m, args, arg, ext);
                break;
            case 'profile':
                this.profile(m, args, arg, ext);
                break;
            case 'rules':
                this.rules(m, args, arg, ext);
                break;
        }
    }

    /**
     * Module Function: Invite player(s) to play Farkle!
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    farkle(m, args, arg, ext) {
        let prep = this.cache.get("0", `prep${m.member.id}`);
        if(prep) return;

        /** @type {Discord.GuildMember[]} */
        var members = [m.member];
        for(let arg of args) {
            let snowflake = Bot.Util.getSnowflakeFromDiscordPing(arg);
            if(!snowflake) continue;
            let member = m.guild.members.cache.get(snowflake);
            if(!member) continue;
            members.push(member);

            let prep = this.cache.get("0", `prep${member.id}`);
            if(prep) return;
        }
        members = [ ...new Set(members) ];
        if(members.length <= 1) {
            return "No valid members found. Mention the users or type their user ID's.";
        }
        if(members.some(v => v.user.bot)) {
            return "You can't invite a bot!";
        }
        for(let i = 0; i < members.length; i++) {
            this.cache.set("0", `prep${members[i].id}`, undefined);
        }
        this.bot.sql.transaction(async query => {
            for(let member of members) {
                var docS = (await query(`SELECT * FROM farkle_servers WHERE user_id = ${member.id}`)).results[0];
                if(docS) {
                    await m.channel.send("One or more invited players are already in a Farkle lobby looking for a game.");
                    return;
                }
            }

            /** @type {Discord.DMChannel[]} */
            const channels = [];
            for(let i = 0; i < members.length; i++) {
                channels[i] = await members[i].createDM();
            }

            /** @type {Db.farkle_current_players[]} */
            var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${m.member.id}`)).results;
            if(docCPs.length > 0) {
                await m.channel.send("You're already in a Farkle match!");
                return;
            }
 
            /** @type {Db.farkle_current_players[]} */
            var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${members.map(v=>v.id).join(" OR user_id = ")}`)).results;
            if(docCPs.length > 0) {
                
                let messageErr = await m.channel.send("...");
                await messageErr.edit(`${docCPs.map(v=>`<@${v.user_id}>`).join(", ")} are already in another Farkle match!`);
                return;
            }

            let now = new Date();

            for(let i = 0; i < members.length; i++) {
                this.cache.set("0", `prep${members[i].id}`, {
                    date: now,
                    members: members,
                    host: m.member,
                    channels: channels,
                    guild: m.guild
                });
            }

            let embed = getEmbedBlank();
            embed.description = `Choose the __points goal__ between 1000 and 10000 (suggested 4000).
Followed by a comma, optionally choose the __opening turn point threshold__ between 350 and 1000 (commonly 350, 400, 500, or 1000).
Optionally choose if you would like to play the __high-stakes variant__ by typing \`hs\` anywhere.
Optionally choose if you would like to play the __welfare variant__ by typing \`wf\` anywhere.
    
Examples:
\`4000\` - 4000 goal, 0 opening turn threshold.
\`6000, 500\` - 6000 goal, 500 opening turn threshold.
\`5000 hs\` - 5000 goal, high-stakes variant.
\`4000, 400 hs wf\` - 5000 goal, 400 opening turn threshold, high-stakes variant, welfare variant.

Type \`cancel\` to cancel the match.`;

            await m.channel.send({embeds: [embed]});
        }).catch(console.error);
    }

    /**
     * Module Function: Host a server so others can join, as an alternative to direct invites.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    host(m, args, arg, ext) {
        this.bot.sql.transaction(async query => {
            /** @type {Db.farkle_current_players[]} */
            var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${m.member.id}`)).results;
            if(docCPs.length > 0) {
                await m.channel.send("You're already in a Farkle match!");
                return;
            }

            /** @type {Db.farkle_servers} */
            let server = {
                guild_id: m.guild.id,
                user_id: m.member.id,
                user_id_host: m.member.id
            }

            let embed = getEmbedBlank();
            embed.description = `<@${server.user_id}> is looking for people to play Farkle!\n\nType -> !farkle join <@${server.user_id}> <- to join.`;

            /** @type {Db.farkle_servers|undefined} */
            var docS = (await query(`SELECT * FROM farkle_servers WHERE user_id = ${m.member.id}`)).results[0];
            if(docS) {
                if(docS.user_id === docS.user_id_host) {
                    await m.channel.send({ embeds: [embed] });
                    return;
                }
                else {
                    await m.channel.send("You are already in another lobby! Leave it first.");
                    return;
                }
            }

            await m.channel.send({ embeds: [embed] });

            await query(Bot.Util.SQL.getInsert(server, "farkle_servers"));
        }).catch(logger.error);
    }

    /**
     * Module Function: Leave the server.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    leave(m, args, arg, ext) {
        this.bot.sql.transaction(async query => {
            /** @type {Db.farkle_servers | undefined} */
            var docS = (await query(`SELECT * FROM farkle_servers WHERE user_id = ${m.member.id}`)).results[0];
            if(!docS) {
                await m.channel.send("You're not in a lobby.");
                return;
            }
            
            if(docS.user_id_host !== docS.user_id) {
                await query(`DELETE FROM farkle_servers WHERE user_id = ${m.member.id}`);

                /** @type {Db.farkle_servers[]} */
                let docSs = (await query(`SELECT * FROM farkle_servers WHERE user_id_host = ${docS.user_id_host}`)).results;

                let embed = getEmbedBlank();
                embed.description = `<@${docS.user_id}> left.\nThere's ${docSs.length} player(s) waiting: ${docSs.map(v => `<@${v.user_id}> `)}\n\n${docSs.length > 1 ? `<@${docS.user_id_host}> needs to type \`!farkle start\` to begin the game, or wait for more players.` : ""}`;
                await m.channel.send({ content: docSs.length > 1 ? `<@${docS.user_id_host}>` : "", embeds: [embed] });
            }
            else {
                await query(`DELETE FROM farkle_servers WHERE user_id_host = ${m.member.id}`);

                let embed = getEmbedBlank();
                embed.description = `${m.member} disbanded the lobby.`;
                await m.channel.send({ embeds: [embed] });
            }
        }).catch(logger.error);
    }

    /**
     * 
     * @param {Bot.Message} m 
     * @param {Discord.GuildMember} hostMember
     * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
     */
    async _join(m, hostMember, query) {
        /** @type {Db.farkle_current_players[]} */
        var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${m.member.id}`)).results;
        if(docCPs.length > 0) {
            await m.channel.send("You're already in a Farkle match!");
            return;
        }
        /** @type {Db.farkle_servers[]} */
        var docSs = (await query(`SELECT * FROM farkle_servers WHERE user_id_host = ${hostMember.id} AND guild_id = ${m.guild.id}`)).results;
        if(docSs.length === 0) {
            await m.channel.send("This user isn't hosting a lobby!");
            return;
        }
        /** @type {Db.farkle_servers[]} */
        var docSs = (await query(`SELECT * FROM farkle_servers WHERE user_id_host = ${hostMember.id} AND guild_id = ${m.guild.id} AND user_id = ${m.member.id}`)).results;
        if(docSs.length > 0) {
            await m.channel.send("You're already in this lobby.");
            return;
        }
        /** @type {Db.farkle_servers[]} */
        var docSs = (await query(`SELECT * FROM farkle_servers WHERE user_id = ${m.member.id}`)).results;
        if(docSs.length > 0) {
            await m.channel.send("You are already in another lobby! Leave it first.");
            return;
        }

        /** @type {Db.farkle_servers} */
        let server = {
            guild_id: m.guild.id,
            user_id: m.member.id,
            user_id_host: hostMember.id
        }

        await query(Bot.Util.SQL.getInsert(server, "farkle_servers"));

        /** @type {Db.farkle_servers[]} */
        var docSs = (await query(`SELECT * FROM farkle_servers WHERE user_id_host = ${hostMember.id}`)).results;

        let embed = getEmbedBlank();
        embed.description = `${m.member} has joined!\nThere's ${docSs.length} player(s) waiting: ${docSs.map(v => `<@${v.user_id}> `)}\n\n${hostMember} needs to type \`!farkle start\` to begin the game, or wait for more players.`;
        await m.channel.send({ content: `${hostMember}`, embeds: [embed] });
    }

    /**
     * Module Function: Join a server.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    join(m, args, arg, ext) {
        let prep = this.cache.get("0", `prep${m.member.id}`);
        if(prep) return;

        if(arg.length === 0) {
            this.bot.sql.transaction(async query => {
                /** @type {Db.farkle_servers[]} */
                let docSs = (await query(`SELECT * FROM farkle_servers WHERE guild_id = ${m.guild.id} AND user_id = user_id_host`)).results;
                if(docSs.length === 0) {
                    await m.channel.send("There are no lobbies to join.");
                    return;
                }

                for(let i = docSs.length - 1; i >= 0; i--) {
                    let docS = docSs[i];

                    let hostMember = await m.guild.members.fetch(docS.user_id_host);
                    if(hostMember == null) {
                        await m.channel.send("The user who created this lobby is no longer a member of this server. The lobby has been deleted.");
                        await query(`DELETE FROM farkle_servers WHERE user_id_host = ${docS.user_id_host}`);
                        return;
                    }
                    
                    await this._join(m, hostMember, query);
                    return;
                }

                await m.channel.send("There are no lobbies to join (2).");
                return;
            }).catch(logger.error);
            return;
        }

        let _hostSnowflake = Bot.Util.getSnowflakeFromDiscordPing(arg);
        if(!_hostSnowflake)
            return "Invalid user ping";
        let hostSnowflake = _hostSnowflake;

        this.bot.sql.transaction(async query => {
            let hostMember = await m.guild.members.fetch(hostSnowflake);
            if(!hostMember)
                await m.channel.send("Mentioned user is not a member of this server.");

            await this._join(m, hostMember, query);
            return;
        }).catch(logger.error);
    }

    /**
     * Module Function: Start the game with all players in the server.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    start(m, args, arg, ext) {
        this.bot.sql.transaction(async query => {
            /** @type {Db.farkle_servers[]} */
            var docSs = (await query(`SELECT * FROM farkle_servers WHERE guild_id = ${m.guild.id} AND user_id_host = ${m.member.id} AND user_id = user_id_host`)).results;
            if(docSs.length === 0) {
                await m.channel.send("You're not a host of a lobby.");
                return;
            }

            /** @type {Db.farkle_servers[]} */
            var docSs = (await query(`SELECT * FROM farkle_servers WHERE guild_id = ${m.guild.id} AND user_id_host = ${m.member.id}`)).results;
            if(docSs.length <= 1) {
                await m.channel.send("Nobody has joined your lobby yet.");
                return;
            }

            await query(`DELETE FROM farkle_servers WHERE user_id_host = ${m.member.id}`);

            let args = docSs.map(v => v.user_id);
            return args;
        }).then(args => {
            let arg = (args??[]).join(" ");
            this.farkle(m, args??[], arg, ext);
        }).catch(logger.error);
    }

    /**
     * Module Function: Change the look of the dice.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    skin(m, args, arg, ext) {
        if(arg.length === 0) {
            m.channel.send(`Available skins: \`${Object.keys(F.skins).join("`, `")}\`.\nType \`!farkle skin <type>\` to use.`).catch(logger.error);
            return;
        }

        if(!Object.keys(F.skins).includes(arg)) {
            m.channel.send(`Not a valid skin name.\nAvailable skins: \`${Object.keys(F.skins).join("`, `")}\`.\nType !farkle skin <type> to use.`).catch(logger.error);
            return;
        }

        this.bot.sql.transaction(async query => {
            /** @type {Db.farkle_users} */
            let user = {
                user_id: m.member.id,
                skin: arg,
            }

            //await query(`IF EXISTS ( SELECT * FROM farkle_users WHERE user_id = ${message.member.id} ) UPDATE farkle_users SET skin = "${arg}" WHERE user_id = ${message.member.id} ELSE ${BotUtil.SQL.getInsert(user, "farkle_users")}`);
            /** @type {Db.farkle_users|undefined} */
            let docU = (await query(`SELECT * FROM farkle_users WHERE user_id = ${m.member.id}`)).results[0];
            if(docU)
                await query(`UPDATE farkle_users SET skin = "${arg}" WHERE user_id = ${m.member.id}`);
            else
                await query(Bot.Util.SQL.getInsert(user, "farkle_users"));
            
            await m.channel.send(`Skin changed: ${Object.values(F.skins[arg]).join("")}`);
        }).catch(logger.error);
    }

    /**
     * Module Function: Display current games played by members of this server.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    games(m, args, arg, ext) {
        this.bot.sql.transaction(async query => {
            const embed = getEmbedBlank();

            var str = "";

            /** @type {Db.farkle_current_games[]} */
            let docCGs = (await query(`SELECT * FROM farkle_current_games`)).results;
            if(docCGs.length === 0) {
                await m.channel.send("There are no games being played right now.");
                return;
            }

            var i = 1;
            for(let docCG of docCGs) {
                str += `Game #${i} • Goal: ${docCG.points_goal}\n`;

                /** @type {Db.farkle_current_players[]} */
                let docCPs = (await query(`SELECT * FROM farkle_current_players WHERE id_current_games = ${docCG.id} ORDER BY total_points_banked DESC`)).results;

                for(let docCP of docCPs) {
                    str += `  • <@${docCP.user_id}>: ${docCP.total_points_banked} pts`;
                    str += "\n";
                }
                str += "\n";
                i++;
            }
            embed.description = str;
            await m.channel.send({ embeds: [embed] });
            return;
        }).catch(logger.error);
    }

    /**
     * Module Function: Display profile.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    profile(m, args, arg, ext) {
        this.bot.sql.transaction(async query => {
            let embed = getEmbedBlank();
            embed.title = "Farkle";
            embed.author = {
                name: m.message.author.username + "#" + m.message.author.discriminator,
                iconURL: m.message.author.displayAvatarURL()
            }
            const lastSeen = await Q.getPlayerLastSeen(m.member.id, query);

            embed.description = `Last Seen: ${lastSeen > 0 ? Bot.Util.getFormattedDate(lastSeen, true) : "Never"}`;

            embed.fields = [];

            const players = await Q.getPlayerHighestPlayerCountGamePlayed(m.member.id, query);
            const wl = {
                regular: {
                    wins: 0,
                    losses: 0,
                },
                weighted: {
                    wins: 0,
                    losses: 0
                }
            }

            for(let i = 2; i <= players; i++) {
                const wins = await Q.getPlayerWinsInXPlayerMatches(m.member.id, query, i);
                const losses = await Q.getPlayerGamesInXPPlayerMatches(m.member.id, query, i) - wins;

                wl.regular.wins += wins;
                wl.regular.losses += losses;

                wl.weighted.wins += wins * i / 2;
                wl.weighted.losses += losses / i * 2;
            }

            embed.fields.push({
                inline: true,
                name: "Wins • Losses",
                value: `${wl.regular.wins} • ${wl.regular.losses} (Total)\n${dollarify(Math.round, wl.weighted.wins)} • ${dollarify(Math.round, wl.weighted.losses)} (Weighted)`
            });

            const fieldTotal = {
                inline: true,
                name: "Totals",
                value: ""
            };

            var doc = (await query(`select sum(total_points_banked) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Pts banked: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_points_lost) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Pts lost: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_points_skipped) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Pts skipped: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_points_piggybacked_banked) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Piggybacks banked: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_points_piggybacked_lost) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Piggybacks lost: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_points_welfare_gained) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Welfares given: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_points_welfare_lost) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Welfares lost: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_rolls) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Rolls: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_folds) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Folds: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_finishes) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Finishes: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_skips) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Skips: ${doc ? doc.total : 0}\n`;

            var doc = (await query(`select sum(total_welfares) as 'total' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldTotal.value += `Welfares: ${doc ? doc.total : 0}\n`;

            embed.fields.push(fieldTotal);


            const fieldBest = {
                inline: true,
                name: "Single turn highest",
                value: ""
            };

            var doc = (await query(`select max(highest_points_banked) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Pts banked: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_points_lost) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Pts lost: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_points_skipped) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Pts skipped: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_points_piggybacked_banked) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Piggybacks banked: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_points_piggybacked_lost) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Piggybacks lost: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_points_welfare_gained) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Welfares given: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_points_welfare_lost) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Welfares lost: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_rolls_in_turn) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Rolls: ${doc ? doc.highest : 0}\n`;

            var doc = (await query(`select max(highest_rolls_in_turn_without_fold) as 'highest' from farkle_history_players where user_id = ${m.member.id} group by user_id`)).results[0];
            fieldBest.value += `Rolls w/o farkle: ${doc ? doc.highest : 0}\n`;

            embed.fields.push(fieldBest);

            embed.fields.push({
                inline: true,
                name: "⠀",
                value: `⠀`
            });
            
            await m.channel.send({ embeds: [embed] });
            return;
        }).catch(logger.error);
    }

    /**
     * Module Function: Spectate a game.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    spectate(m, args, arg, ext) {
        let _hostSnowflake = Bot.Util.getSnowflakeFromDiscordPing(arg);
        if(!_hostSnowflake)
            return "Invalid user ping";
        let hostSnowflake = _hostSnowflake;

        this.bot.sql.transaction(async query => {
            let hostMember = await m.guild.members.fetch(hostSnowflake);
            if(!hostMember) {
                await m.channel.send("Mentioned user is not a member of this server.");
                return;
            }

            /** @type {Db.farkle_current_players[]} */
            var docCPs = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${m.member.id}`)).results;
            if(docCPs.length > 0) {
                await m.channel.send("You're already in a Farkle match!");
                return;
            }
            /** @type {Db.farkle_current_players|undefined} */
            var docCP = (await query(`SELECT * FROM farkle_current_players WHERE user_id = ${hostMember.id}`)).results[0];
            if(docCP == null) {
                await m.channel.send("This user is not in a game.");
                return;
            }

            let dm = await m.member.createDM();

            /** @type {Db.farkle_viewers} */
            let viewer = {
                user_id_target: docCP.user_id,
                user_id: m.member.id,
                channel_dm_id: dm.id
            }

            /** @type {Db.farkle_viewers|undefined} */
            let docV = (await query(`SELECT * FROM farkle_viewers WHERE user_id = ${m.member.id}`)).results[0];
            if(docV) {
                await query(`DELETE FROM farkle_viewers WHERE user_id = ${m.member.id}`);

                if(docV.user_id_target === viewer.user_id_target) {
                    await m.channel.send("You're no longer spectating this game.");
                    return;
                }
            }

            await query(Bot.Util.SQL.getInsert(viewer, "farkle_viewers"));

            await m.channel.send("Now spectating...");
        }).catch(logger.error);
    }

    /**
     * Module Function: Get Farkle rules.
     * @param {Bot.Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    rules(m, args, arg, ext) {
        var embed = getEmbedBlank();
        
        this.bot.sql.transaction(async query => {
            /** @type {Db.farkle_users|null} */
            let docU = (await query(`SELECT * FROM farkle_users WHERE user_id = ${m.member.id}`)).results[0];
            let skin = F.skins[docU ? docU.skin : "braille"];

            var str = `https://en.wikipedia.org/wiki/Farkle
            
Farkle is played by two or more players, with each player in succession having a turn at throwing the dice. Each player's turn results in a score, and the scores for each player accumulate to some winning total. 
   At the beginning of each turn, the player throws six dice at once.
   After each throw, one or more scoring dice must be set aside (see sections on scoring below).
   The player may then either end their turn and bank the score accumulated so far, or continue to throw the remaining dice.
   If the player has scored all six dice, they have "hot dice" and may continue their turn with a new throw of all six dice, adding to the score they have already accumulated. There is no limit to the number of "hot dice" a player may roll in one turn.
   If none of the dice score in any given throw, the player has "farkled" and all points for that turn are lost.
   At the end of the player's turn, the dice are handed to the next player in succession, and they have their turn.

__Local terminology:__
   \`keep\` command - Set aside one or more scoring dice, then continue to throw the remaining dice. e.g. \`keep 111\` = set aside three 1's and continue to roll the remaining dice.
   \`finish\` command - Set aside one or more scoring dice, then bank the accumulated score end your turn. e.g. \`finish 111\` = set aside three 1's, bank your points and end your turn.
            
__Scoring rules:__
   **Single ${skin[1]}** - 100 points
   **Single ${skin[5]}** - 50 points

   **Three of a kind** - 100 points times the number on the dice. ${skin[1]} counts as 10.
   **Four or more of a kind** - double the points of a three of a kind.
   e.g. three 4's are worth 400, four 4's 800, five 4's 1600, six 4's 3200.

   **Five in a row**
   ${skin[1]}${skin[2]}${skin[3]}${skin[4]}${skin[5]} - 500 points
   ${skin[2]}${skin[3]}${skin[4]}${skin[5]}${skin[6]} - 750 points

   **Six in a row**
   ${skin[1]}${skin[2]}${skin[3]}${skin[4]}${skin[5]}${skin[6]} - 1500 points
   
__High-stakes:__
   In a variant described as "piggybacking" or "high-stakes", each player after the first can choose to begin their turn either with a fresh set of six dice, or by throwing the dice remaining after the previous player has completed their turn. For example, if a player banks three 1's for a score of 1000, the next player may choose to roll the remaining three dice. If they score at least one die, they score 1000 plus whatever additional score they accumulate. Players may thus assume the greater risk of farkling for the chance of scoring the points already accumulated by the player before them. If a player ends their turn on a "hot dice", the next player may "piggyback" using all six dice.
   
__Welfare:__
   An end-of-game variation described as "welfare" requires the winner to score exactly the required amount of points. If a player scores more than than that in a turn, the player automatically farkles and all points scored in that turn are given to the player with the lowest score (unless it is the current player). If multiple other players have the same lowest score, points are given to the player furthest away in turn order.`;
            embed.description = str;
            await m.channel.send({ embeds: [embed] });
        }).catch(logger.error);
    }
}

/**
 * @param {(arg0: number) => number} method
 * @param {number} number 
 * @returns {number}
 */
function dollarify(method, number) {
    return method(number * 100) / 100;
}

/**
 * @returns {Discord.MessageEmbed}
 */
function getEmbedBlank() {
    return new Discord.MessageEmbed({
        title: `:game_die: Farkle`,
        timestamp: new Date(),
        description: ""
    });
}

/**
 * @param {Db.farkle_current_games} docCG
 * @param {Db.farkle_current_players[]} docCPs
 * @param {boolean=} totalIsBank
 * @returns {Discord.MessageEmbed}
 */
function getEmbedUser(docCG, docCPs, totalIsBank) {
    var docCP = docCPs.find(v => v.user_id === docCG.current_player_user_id);
    const bank = docCP ? docCP.total_points_banked : -1;
    const round = docCG.current_player_points;

    return new Discord.MessageEmbed({
        title: `:game_die: Farkle`,
        color: docCP ? F.colors[docCP.turn_order] : 0,
        timestamp: new Date(),
        footer: {
            text: `Goal: ${docCG.points_goal} • Bank: ${bank} • Round: ${round} • Total: ${totalIsBank ? bank : bank+round}`
        },
        description: ""
    });
}

/**
 * 
 * @param {number[]} rolls 
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
function getRollsGrid(rolls, width, height) {
    /** @type {Array<number[]>} */
    var arr = [];
    for(let y = 0; y < height; y++) {
        arr[y] = [];
    }

    for(let i = 0; i < rolls.length; i++) {
        let roll = rolls[i];

        let x, y;
        loop:
        while(true) {
            x = Bot.Util.getRandomInt(0, width);
            y = Bot.Util.getRandomInt(0, height);

            if(arr[y][x] != null) continue loop;
            if(arr[y - 1] && arr[y - 1][x] != null) continue loop;
            if(arr[y + 1] && arr[y + 1][x] != null) continue loop;
            if(arr[y][x - 1] != null) continue loop;
            if(arr[y][x + 1] != null) continue loop;

            arr[y][x] = roll;
            break;
        }
    }

    var str = "";
    for(let y = 0; y < height; y++) {
        for(let x = 0; x < width; x++) {
            if(arr[y][x] == null)
                str += `   `;
            else
                str += `%${arr[y][x]}%`;
        }
        str += "\n";
    }

    return "```" + str + "```";
}













//*****************************
//************LOGIC************
//*****************************

/**
 * Does not modify arrays. `true` if current rolls are a fold, otherwise `false`.
 * @param {number[]} rolls 
 * @returns {boolean}
 */
function getFold(rolls) {
    for(let match of F.matches) {
        if(getValidKeep(rolls, match.m))
            return false;
    }
    return true;
}

/**
 * Does not modify arrays. `true` if `keep` is valid with `rolls`, otherwise `false`.
 * @param {number[]} rolls 
 * @param {number[]} keep
 * @returns {boolean} 
 */
function getValidKeep(rolls, keep) {
    let rollsT = [...rolls];
    let keepT = [...keep];

    for(let i = 0; i < rollsT.length; i++) {
        for(let j = 0; j < keepT.length; j++) {
            if(rollsT[i] === keepT[j]) {
                rollsT.splice(i, 1);
                keepT.splice(j, 1);
                i--;
                j--;
            }
        }
    }

    if(keepT.length > 0)
        return false;
    return true;
}

/**
 * Modifies arrays. Returns points current player will get. 0 if `keep` is invalid.
 * @param {number[]} rolls 
 * @param {number[]} keep 
 * @returns {number}
 */
function processFarkleKeep(rolls, keep) {
    var points = 0;

    loop:
    while(true) {
        for(let match of F.matches) {
            let matchT = [...match.m];
            let keepT = [...keep];

            for(let i = 0; i < matchT.length; i++) {
                for(let j = 0; j < keepT.length; j++) {
                    if(matchT[i] === keepT[j]) {
                        matchT.splice(i, 1);
                        keepT.splice(j, 1);
                        i--;
                        j--;
                    }
                }
            }

            if(matchT.length === 0) {
                match.m.forEach(n => {
                    rolls.splice(rolls.indexOf(n), 1);
                    keep.splice(keep.indexOf(n), 1);
                });
                keep = keepT;
                points += match.p;
                continue loop;
            }

            if(keep.length === 0) return points;
        }
        if(keep.length > 0) return 0;

        return points;
    }
}







//*****************************
//****FARKLE LOOP HELPERS******
//*****************************
/**
 * @this Farkle
 * @param { { type: ActionType|GameType, updateCurrentMatch: boolean, gameEnded: boolean } } state
 * @param {Db.farkle_current_games} docCG 
 * @param {Db.farkle_current_players} docCP 
 * @param {Db.farkle_current_players[]} docCPs 
 * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
 * @param {Discord.Client} client
 */
async function commit(state, docCG, docCP, docCPs, query, client) {
    if(state.type === "reject") {
        for(let player of docCPs) {
            await query(`DELETE FROM farkle_viewers WHERE user_id_target = ${player.user_id}`);
        }
        await query(`DELETE FROM farkle_current_players WHERE id_current_games = ${docCG.id}`);
        await query(`DELETE FROM farkle_current_games WHERE id = ${docCG.id}`);

        return;
    }

    if(state.type === "ready") {
        for(let player of docCPs) {
            await query(`DELETE FROM farkle_viewers WHERE user_id = ${player.user_id}`);
            await query(`UPDATE farkle_current_games SET has_started = true, match_start_time = ${Date.now()} WHERE id = ${docCG.id}`);
            for(let player of docCPs) {
                await query (`UPDATE farkle_current_players SET turn_order = ${player.turn_order} WHERE user_id = ${player.user_id} AND id_current_games = ${player.id_current_games}`);
            }
        }
    }

    if(state.type === "concede") {
        await query(`DELETE FROM farkle_viewers WHERE user_id_target = ${docCP.user_id}`);
        await query(`DELETE FROM farkle_current_players WHERE user_id = ${docCP.user_id} AND id_current_games = ${docCP.id_current_games}`);
        docCPs = (await query(`SELECT * FROM farkle_current_players WHERE id_current_games = ${docCP.id_current_games}`)).results;

        for(let player of docCPs) {
            await query (`UPDATE farkle_current_players SET turn_order = ${player.turn_order} WHERE user_id = ${player.user_id} AND id_current_games = ${player.id_current_games}`);
        }

        /** @type {Db.farkle_history_players} */
        let playerH = {
            id: /** @type {number} */(docCP.id),
            id_history_games: /** @type {number} */(docCG.id),
            user_id: docCP.user_id,
            turn_order: docCP.turn_order,
            has_conceded: true,
            total_points_banked: docCP.total_points_banked,
            total_points_lost: docCP.total_points_lost,
            total_points_skipped: docCP.total_points_skipped,
            total_points_piggybacked_banked: docCP.total_points_piggybacked_banked,
            total_points_piggybacked_lost: docCP.total_points_piggybacked_lost,
            total_points_welfare_gained: docCP.total_points_welfare_gained,
            total_points_welfare_lost: docCP.total_points_welfare_lost, 
            total_rolls: docCP.total_rolls,
            total_folds: docCP.total_folds,
            total_finishes: docCP.total_finishes,
            total_skips: docCP.total_skips,
            total_welfares: docCP.total_welfares,
            highest_points_banked: docCP.highest_points_banked,
            highest_points_lost: docCP.highest_points_lost,
            highest_points_skipped: docCP.highest_points_skipped,
            highest_points_piggybacked_banked: docCP.highest_points_piggybacked_banked,
            highest_points_piggybacked_lost: docCP.highest_points_piggybacked_lost,
            highest_points_welfare_gained: docCP.highest_points_welfare_gained,
            highest_points_welfare_lost: docCP.highest_points_welfare_lost,
            highest_rolls_in_turn: docCP.highest_rolls_in_turn,
            highest_rolls_in_turn_without_fold: docCP.highest_rolls_in_turn_without_fold
        }
        await query(Bot.Util.SQL.getInsert(playerH, "farkle_history_players"));
    }

    //TODO this needs to be manually updated when these kinds of new values are added
    if(state.updateCurrentMatch) {
        await query(`UPDATE farkle_current_games SET current_player_user_id = ${docCG.current_player_user_id}, current_player_rolls = "${docCG.current_player_rolls}", current_player_points = ${docCG.current_player_points}, current_player_rolls_count = ${docCG.current_player_rolls_count}, current_player_high_stakes_choice = ${docCG.current_player_high_stakes_choice}, current_player_points_piggybacked = ${docCG.current_player_points_piggybacked} WHERE id = ${docCG.id}`);

        for(let player of docCPs) {
            await query (`UPDATE farkle_current_players SET total_points_banked = ${player.total_points_banked}, total_points_lost = ${player.total_points_lost}, total_points_skipped = ${player.total_points_skipped}, total_points_piggybacked_banked = ${player.total_points_piggybacked_banked}, total_points_piggybacked_lost = ${player.total_points_piggybacked_lost}, total_points_welfare_gained = ${player.total_points_welfare_gained}, total_points_welfare_lost = ${player.total_points_welfare_lost}, total_rolls = ${player.total_rolls}, total_folds = ${player.total_folds}, total_finishes = ${player.total_finishes}, total_skips = ${player.total_skips}, total_welfares = ${player.total_welfares}, highest_points_banked = ${player.highest_points_banked}, highest_points_lost = ${player.highest_points_lost}, highest_points_skipped = ${player.highest_points_skipped}, highest_points_piggybacked_banked = ${player.highest_points_piggybacked_banked}, highest_points_piggybacked_lost = ${player.highest_points_piggybacked_lost}, highest_points_welfare_gained = ${player.highest_points_welfare_gained}, highest_points_welfare_lost = ${player.highest_points_welfare_lost}, highest_rolls_in_turn = ${player.highest_rolls_in_turn}, highest_rolls_in_turn_without_fold = ${player.highest_rolls_in_turn_without_fold} WHERE user_id = ${player.user_id} AND id_current_games = ${player.id_current_games}`);
        }
    }

    if(state.gameEnded) {
        for(let player of docCPs) {
            await query(`DELETE FROM farkle_viewers WHERE user_id_target = ${player.user_id}`);
        }
        await query(`DELETE FROM farkle_current_players WHERE id_current_games = ${docCG.id}`);
        await query(`DELETE FROM farkle_current_games WHERE id = ${docCG.id}`);

        /** @type {Db.farkle_history_games} */
        let gameH = {
            id: /** @type {number} */(docCG.id),
            guild_id: docCG.guild_id,
            match_start_time: docCG.match_start_time,
            match_end_time: Date.now(),
            points_goal: docCG.points_goal,
            user_id_winner: docCG.current_player_user_id,
            opening_turn_point_threshold: docCG.opening_turn_point_threshold,
            high_stakes_variant: docCG.high_stakes_variant,
            welfare_variant: docCG.welfare_variant
        }
        await query(Bot.Util.SQL.getInsert(gameH, "farkle_history_games"));

        for(let player of docCPs) {
            /** @type {Db.farkle_history_players} */
            let playerH = {
                id: /** @type {number} */(player.id),
                id_history_games: /** @type {number} */(gameH.id),
                user_id: player.user_id,
                turn_order: player.turn_order,
                has_conceded: false,
                total_points_banked: player.total_points_banked,
                total_points_lost: player.total_points_lost,
                total_points_skipped: player.total_points_skipped,
                total_points_piggybacked_banked: player.total_points_piggybacked_banked,
                total_points_piggybacked_lost: player.total_points_piggybacked_lost,
                total_points_welfare_gained: player.total_points_welfare_gained,
                total_points_welfare_lost: player.total_points_welfare_lost,
                total_rolls: player.total_rolls,
                total_folds: player.total_folds,
                total_finishes: player.total_finishes,
                total_skips: player.total_skips,
                total_welfares: player.total_welfares,
                highest_points_banked: player.highest_points_banked,
                highest_points_lost: player.highest_points_lost,
                highest_points_skipped: player.highest_points_skipped,
                highest_points_piggybacked_banked: player.highest_points_piggybacked_banked,
                highest_points_piggybacked_lost: player.highest_points_piggybacked_lost,
                highest_points_welfare_gained: player.highest_points_welfare_gained,
                highest_points_welfare_lost: player.highest_points_welfare_lost,
                highest_rolls_in_turn: player.highest_rolls_in_turn,
                highest_rolls_in_turn_without_fold: player.highest_rolls_in_turn_without_fold
            }
            await query(Bot.Util.SQL.getInsert(playerH, "farkle_history_players"));
        }

        /** @type {(Db.farkle_current_players|Db.farkle_history_players)[]} */
        let thisGameCHPs = Array.from((await query(`SELECT * FROM farkle_current_players WHERE id_current_games = ${docCG.id}`)).results).concat((await query(`SELECT * FROM farkle_history_players WHERE id_history_games = ${docCG.id}`)).results);
        postGameEndMessage.call(this, client, docCG, thisGameCHPs).catch(logger.error);
    }
}

/**
 * @this Farkle
 * @param {Discord.Client} client
 * @param {Db.farkle_current_games} docCG 
 * @param {Db.farkle_current_players} docCP
 * @param {Db.farkle_current_players[]} docCPs
 * @param {(Db.farkle_viewers|Db.farkle_current_players)[]} docCPVs
 */
async function decide(client, docCG, docCP, docCPs, docCPVs) {
    var docCPsRemaining = docCPs.slice();
    var docCPsTemp = docCPsRemaining.slice();
    var embed = getEmbedBlank();
    var turn = 1;

    while(true) {
        let str = "";

        /** @type {{rolls: number[], players: Db.farkle_current_players[], highest: number}} */
        let obj = _decide(docCPsTemp);

        for(let i = 0; i < docCPsTemp.length; i++) {
            let player = docCPsTemp[i];
            str += `\`${obj.rolls[i]}\`: <@${player.user_id}>\n`
        }
        str += "\n";

        if(obj.players.length > 1) {
            docCPsTemp = docCPsTemp.filter(v => {
                for(let i = 0; i < obj.players.length; i++) {
                    if(v === obj.players[i])
                        return true;
                }
            });
        }
        else {
            str += `<@${obj.players[0].user_id}> is in place ${turn}.`;
            docCPsRemaining = docCPsRemaining.filter(v => {
                if(v !== obj.players[0])
                    return true;
            });
            docCPsTemp = docCPsRemaining.slice();

            obj.players[0].turn_order = turn;

            if(turn === 1) {
                docCG.current_player_user_id = obj.players[0].user_id;
            }
            turn++;

            if(docCPsRemaining.length === 1) {
                str += `\n<@${docCPsRemaining[0].user_id}> is in place ${turn}.`;

                docCPsRemaining[0].turn_order = turn;
            }
        }

        embed.description = str;
        for(let attendee of docCPVs) {
            await (await (await client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] });
        }

        await Bot.Util.Promise.sleep(2500);

        if(docCPsRemaining.length === 1) return;
    }
}
/**
 * 
 * @param {Db.farkle_current_players[]} docCPs
 * @returns {{rolls: number[], players: Db.farkle_current_players[], highest: number}} 
 */
function _decide(docCPs) {
    /** @type {number[]} */
    let rolls = [];

    for(let player of docCPs) {
        rolls.push(Bot.Util.getRandomInt(1, 7));
    }

    let highest = 0;
    /** @type {Db.farkle_current_players[]} */ let players = [];

    for(let i = 0; i < rolls.length; i++) {
        let roll = rolls[i];
        if(roll === highest) {
            players.push(docCPs[i]);
        }
        else if(roll > highest) {
            players = [];
            highest = roll;
            players.push(docCPs[i]);
        }
    }

    return {
        rolls: rolls,
        players: players,
        highest: highest
    }
}

/**
 * @param {Db.farkle_current_players | Db.farkle_viewers} attendee
 * @param {{ type: ActionType|GameType|null, keep: number[], points: number, bank?: number, player: Discord.Snowflake, targetPlayer?: Discord.Snowflake }} action 
 * @returns {string}
 */
function getLastActionString(attendee, action) {
    let str = "";

    if(action.type) {
        let name = `<@${action.player}>`;
        if(attendee.user_id === action.player) name = "You";

        switch(action.type) {
        case "keep":
            str = `> ${name} kept ${action.keep.join(", ")} for ${action.points} points.`;
            break;
        case "finish":
            str = `> ${name} finished ${attendee.user_id===action.player?"your":"their"} turn with ${action.points} points, having last kept ${action.keep.join(", ")}.`;
            //action.bank can be undefined in case of welfare end.
            if(action.bank != null) str += `\n> ${attendee.user_id===action.player?"Your":"Their"} bank is now ${action.bank}.`;
            break;
        case "hurry":
            str = `> ${name} ${attendee.user_id===action.player?"were":"was"} hurried and lost ${action.points} points, as well as the current turn.`;
            break;
        case "concede":
            str = `> ${name} ${attendee.user_id===action.player?"have":"has"} conceded the match.`
            break;
        case "fold":
            str = `> ${name} farkled.`
            break;
        case "new":
            str = `> ${name} chose to begin ${attendee.user_id===action.player?"your":"their"} turn with a new set of six dice.`
            break;
        case "continue":
            str = `> ${name} chose to continue the previous player's turn. ${attendee.user_id===action.player?"You":"They"} start with ${action.points} points.`
            break;
        case "welfare":
            str = `> ${name} farkled.`;
            //targetPlayer can be undefined in case of current player having the lowest amount of points
            if(action.targetPlayer != null) str += ` <@${action.targetPlayer}> received ${action.points} points and is now at ${action.bank} points.`;
        }
        if(action.type != null) str += "\n\n";
    }
    return str;
}

/**
 * @this {Farkle}
 * @param {Discord.Client} client
 * @param {{ type: "keep"|"finish"|"fold"|"hurry"|"concede"|null, keep: number[], points: number, bank?: number, player: Discord.Snowflake }} action
 * @param {Db.farkle_current_games} docCG
 * @param {Db.farkle_current_players[]} docCPs
 * @param {(Db.farkle_viewers|Db.farkle_current_players)[]} docCPVs
 * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
 */
async function highstakes(client, action, docCG, docCPs, docCPVs, query) {
    docCG.current_player_high_stakes_choice = true;

    for(let attendee of docCPVs) {
        let embed = getEmbedUser(docCG, docCPs);
        embed.fields = [];

        embed.description = getLastActionString(attendee, action);

        let count = JSON.parse(docCG.current_player_rolls).length;
        if(count === 0) count = MAX_DICE;
        
        if(attendee.user_id === docCG.current_player_user_id) {
            embed.description += `Type \`new\` or \`n\` to begin your turn with a fresh set of six dice.\nType \`continue\` or \`c\` to continue the previous player's turn. There ${count === 1 ? `**is 1 die**` : `**are ${count} dice**`} on the table to reroll, and you would start with **${action.points} points**.`;
        }
        else {
            embed.description += `<@${docCG.current_player_user_id}> is choosing to either begin their turn with a fresh set of six dice, or to continue the previous player's turn. There ${count === 1 ? `**is 1 die**` : `**are ${count} dice**`} on the table to reroll, and <@${docCG.current_player_user_id}> would start with **${action.points} points**.`;
        }

        await (await (await client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] });
    }
    
}
/**
 * @this {Farkle}
 * @param {Discord.Client} client
 * @param {{ type: "keep"|"finish"|"fold"|"hurry"|"concede"|null, keep: number[], points: number, bank?: number, player: Discord.Snowflake }} action
 * @param {Db.farkle_current_games} docCG
 * @param {Db.farkle_current_players[]} docCPs
 * @param {(Db.farkle_viewers|Db.farkle_current_players)[]} docCPVs
 * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
 */
 async function welfare(client, action, docCG, docCPs, docCPVs, query) {
    for(let attendee of docCPVs) {
        let embed = getEmbedUser(docCG, docCPs);
        embed.fields = [];

        embed.description = getLastActionString(attendee, action);

        if(attendee.user_id === docCG.current_player_user_id) {
            embed.description += `You scored more than the goal of ${docCG.points_goal} points. You must finish your turn with exactly ${docCG.points_goal} points to win.`;
        }
        else {
            embed.description += `<@${docCG.current_player_user_id}> scored more than the goal of ${docCG.points_goal} points. They must finish their turn with exactly ${docCG.points_goal} points to win.`;
        }
        embed.description += '\n\n**Farkle!**';

        await (await (await client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] });
    }
 }

/**
 * Modifies `doc` object. Rolls dice until a player can `keep`.
 * @this {Farkle}
 * @param {Discord.Client} client
 * @param {{ type: ActionType|GameType|null, keep: number[], points: number, bank?: number, player: Discord.Snowflake, targetPlayer?: Discord.Snowflake }} action
 * @param {Db.farkle_current_games} docCG
 * @param {Db.farkle_current_players[]} docCPs
 * @param {(Db.farkle_viewers|Db.farkle_current_players)[]} docCPVs
 * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
 */
async function roll(client, action, docCG, docCPs, docCPVs, query) {
    while(true) {
        let count = JSON.parse(docCG.current_player_rolls).length;
        if(count === 0) count = MAX_DICE;

        const rolls = [];
        for(let i = 0; i < count; i++) {
            rolls[i] = Bot.Util.getRandomInt(1, 7);
        }
        docCG.current_player_rolls = JSON.stringify(rolls);

        let playerCurrent = docCPs.find(v=>v.user_id === docCG.current_player_user_id);
        if(!playerCurrent) throw new Error("Farkle.roll: Player is null");
        playerCurrent.total_rolls++;
        docCG.current_player_rolls_count++;
        if(docCG.current_player_rolls_count > playerCurrent.highest_rolls_in_turn)
            playerCurrent.highest_rolls_in_turn = docCG.current_player_rolls_count;

        const fold = getFold(rolls);
        let grid = getRollsGrid(rolls, 5, 5);
        for(let attendee of docCPVs) {
            let embed = getEmbedUser(docCG, docCPs);
            embed.fields = [];

            embed.description = getLastActionString(attendee, action);

            /** @type {Db.farkle_users|undefined} */
            let docU = (await query(`SELECT * FROM farkle_users WHERE user_id = ${attendee.user_id}`)).results[0];

            let g = grid;
            let s = (docU ? docU.skin : "braille");
            g = g.replace(/%1%/g, ` ${F.skins[s][1]} `);
            g = g.replace(/%2%/g, ` ${F.skins[s][2]} `);
            g = g.replace(/%3%/g, ` ${F.skins[s][3]} `);
            g = g.replace(/%4%/g, ` ${F.skins[s][4]} `);
            g = g.replace(/%5%/g, ` ${F.skins[s][5]} `);
            g = g.replace(/%6%/g, ` ${F.skins[s][6]} `);

            if(attendee.user_id === docCG.current_player_user_id)
                embed.description += `**Your rolls:**\n`;
            else
                embed.description += `**<@${docCG.current_player_user_id}>'s rolls:**\n`;
            if(docCG.opening_turn_point_threshold > 0 && docCPs.find(v => v.user_id === docCG.current_player_user_id)?.total_points_banked === 0) {
                embed.description += `This is ${attendee.user_id === docCG.current_player_user_id ? "your" : `<@${docCG.current_player_user_id}>'s`} __opening turn__. In order to be able to \`finish\`, ${attendee.user_id === docCG.current_player_user_id ? "you" : "they"} must do it with a total of at least ${docCG.opening_turn_point_threshold} points.\n`
            }

            embed.description += g;

            if(docCG.welfare_variant) {
                embed.description += `${attendee.user_id === docCG.current_player_user_id ? "You" : `<@${docCG.current_player_user_id}>`} must have exactly ${docCG.points_goal} points in the bank to win.\n`;
            }

            if(fold) {
                embed.description += `\n**Farkle!**`;
            }
            else {
                if(docCPs.includes(/** @type {Db.farkle_current_players} */(attendee))) {
                    if(attendee.user_id === docCG.current_player_user_id)
                        embed.description += `\n\`help\` • \`keep\` • \`finish\` • \`concede\``;
                    else
                        embed.description += `\n\`help\` • \`hurry\` • \`concede\``;
                }
            }
            
            await (await (await client.users.fetch(attendee.user_id))?.createDM()).send({ embeds: [embed] });
        }
        
        if(fold) {
            action.type = "fold";
            action.player = docCG.current_player_user_id;
            playerCurrent.total_folds++;
            playerCurrent.total_points_lost += docCG.current_player_points;
            playerCurrent.total_points_piggybacked_lost += docCG.current_player_points_piggybacked;
            if(docCG.current_player_points > playerCurrent.highest_points_lost)
                playerCurrent.highest_points_lost = docCG.current_player_points;
            if(docCG.current_player_points_piggybacked > playerCurrent.highest_points_piggybacked_lost)
                playerCurrent.highest_points_piggybacked_lost = docCG.current_player_points_piggybacked;
            await turn.bind(this)(client, docCG, docCPs, query, "fold");
        }
        else {
            break;
        }
    }
}

/**
 * Modifies `docG` object. Moves to next turn.
 * @this {Farkle}
 * @param {Discord.Client} client
 * @param {Db.farkle_current_games} docCG 
 * @param {Db.farkle_current_players[]} docCPs
 * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
 * @param {"finish"|"fold"|"concede"|"hurry"|"welfare"} type
 */
async function turn(client, docCG, docCPs, query, type) {
    docCG.current_player_rolls_count = 0;
    docCG.current_player_points_piggybacked = 0;

    //Do not reset these here if we are playing the high stakes variant and the last player just finished their turn.
    //These will be reset if the player chooses to start from a new set of dice in high stakes.
    if(!(docCG.high_stakes_variant && type === "finish")) {
        docCG.current_player_points = 0;
        docCG.current_player_rolls = "[]";
    }

    var player = docCPs.find(v => v.user_id === docCG.current_player_user_id);
    if(!player) return;
    let playerCurrent = player;

    var player = docCPs.find(v => v.turn_order === playerCurrent.turn_order + 1);
    if(!player) {
        player = docCPs.find(v => v.turn_order === 1);
        if(!player) return;
    }
    let playerNext = player;

    docCG.current_player_user_id = playerNext.user_id;


    let embed = getEmbedBlank();
    let str = "";
    var arr = [];
    for(let player of docCPs) {
        arr.push(player);
    }
    arr.sort((a, b) => b.total_points_banked - a.total_points_banked);
    for(let player of arr) {
        str += `${player.total_points_banked} pts - <@${player.user_id}>\n`;
    }
    embed.description = str;
    
    await (await (await client.users.fetch(playerNext.user_id))?.createDM()).send({ embeds: [embed] });
}

/**
 * @this Farkle
 * @param {Discord.Client} client
 * @param {{ type: ActionType|GameType|null, keep: number[], points: number, bank?: number, player: Discord.Snowflake, targetPlayer?: Discord.Snowflake }} action
 * @param {Db.farkle_current_games} docCG 
 * @param {Db.farkle_viewers[]} docVs
 * @param {Db.farkle_current_players[]} docCPs
 * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
 * @param {"concede"|"no_concede"} type - Whether the second-to-last player conceded the match or not. Purely visual statement.
 */
async function end(client, action, docCG, docVs, docCPs, query, type) {
    for(let player of docCPs) {
        let str = "";
        if(player.user_id === docCG.current_player_user_id)
            str = `You win!`;
        else
            str = `<@${docCG.current_player_user_id}> wins!`;

        let embed = getEmbedUser(docCG, docCPs, true);
        embed.description = `${getLastActionString(player, action)}${str}`;

        await (await (await client.users.fetch(player.user_id))?.createDM()).send({ embeds: [embed] });
    }

    for(let viewer of docVs) {
        let str = `<@${docCG.current_player_user_id}> wins!`;

        let embed = getEmbedUser(docCG, docCPs, true);
        embed.description = `${getLastActionString(viewer, action)}${str}`;
        await (await (await client.users.fetch(viewer.user_id))?.createDM()).send({ embeds: [embed] });
    }
}

const Q = Object.freeze({
    /**
     * @param {Discord.Snowflake} id 
     * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
     * @returns {Promise<number>}
     */
    getPlayerLastSeen: async (id, query) => {
        var q = (await query(`select max(hg.match_end_time)
        from farkle_history_games hg
        join farkle_history_players hp on hg.id = hp.id_history_games
        where hp.user_id = ${id}
        group by hp.user_id`)).results[0];
        if(q) return Object.values(q)[0];
        return 0;
    },

    /**
     * @param {Discord.Snowflake} id 
     * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
     * @returns {Promise<number>}
     */
    getPlayerHighestPlayerCountGamePlayed: async (id, query) => {
        var q = (await query(`select max(sub1.players) as 'players' from(
            select count(hp.id_history_games) as 'players', 'a' as 'a' from farkle_history_players hp
            where hp.id_history_games in (
            select hp2.id_history_games from farkle_history_players hp2
            where hp2.user_id = ${id}
            ) group by hp.id_history_games
            ) sub1 group by sub1.a`)).results[0];
        
        return q ? q.players : 0;
    },

    /**
     * @param {Discord.Snowflake} id 
     * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
     * @param {number} players
     * @returns {Promise<number>}
     */
    getPlayerWinsInXPlayerMatches: async (id, query, players) => {
        var q = (await query(`select count(hg.user_id_winner) as 'wins' from (
            select hp.id_history_games from farkle_history_players hp
            group by hp.id_history_games
            having count(hp.id_history_games) = ${players}) 
            subquery join farkle_history_games hg on subquery.id_history_games = hg.id
            where hg.user_id_winner = ${id}
            group by hg.user_id_winner`)).results[0];

        return q ? q.wins : 0;
    },

    /**
     * @param {Discord.Snowflake} id 
     * @param {(s: string) => Promise<{results: any, fields: any[] | undefined}>} query
     * @param {number} players
     * @returns {Promise<number>}
     */
    getPlayerGamesInXPPlayerMatches: async (id, query, players) => {
        var q = (await query(`select count(sub1.id_history_games) as 'games' from (
            select hp.id_history_games as 'id_history_games', 'a' as 'a' from farkle_history_players hp
            where hp.user_id = ${id}) sub1
            where sub1.id_history_games in (
            select hp2.id_history_games from farkle_history_players hp2
            group by hp2.id_history_games
            having count(hp2.id_history_games) = ${players})
            group by sub1.a`)).results[0];
        
        return q ? q.games : 0;
    },
});

/**
 * @this {Farkle}
 * @param {Discord.Client} client
 * @param {Db.farkle_current_games} docCG
 * @param {(Db.farkle_current_players|Db.farkle_history_players)[]} thisGameCHPs
 */
async function postGameEndMessage(client, docCG, thisGameCHPs) {
    if(this.ServerDefs == null) return;

    var embed = getEmbedBlank();
    embed.description = `Game ended`;
    embed.description += `\n  • Players: ${thisGameCHPs.map(v => `<@${v.user_id}>`).join(", ")}`;
    embed.description += `\n  • Point goal: ${docCG.points_goal}`;
    if(docCG.opening_turn_point_threshold > 0) embed.description += `\n  • Opening turn point threshold: ${docCG.opening_turn_point_threshold}`;
    if(docCG.high_stakes_variant) embed.description += `\n  • **High Stakes**`;
    if(docCG.welfare_variant) embed.description += `\n  • **Welfare**`;
    
    embed.description += '\n\n';
    let players = thisGameCHPs.slice().sort((a, b) => b.total_points_banked - a.total_points_banked);
    for(let docCP of players) {
        embed.description += `<@${docCP.user_id}>'s bank: ${docCP.total_points_banked}\n`;
    }

    let guild = await client.guilds.fetch(this.ServerDefs.guildId);
    let channel = await guild.channels.fetch(this.ServerDefs.farkleChannelId);
    if(channel instanceof Discord.TextChannel) {
        channel.send({ embeds: [embed] });
    }
}