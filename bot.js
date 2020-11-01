'use strict';

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCGameMapManager } from './src/kc/KCGameMapManager.js'; 

const core = new Bot.Core();

core.on('ready', bot => {
    (async () => {
        let kcgmm = new KCGameMapManager({
            disableCW2: true
        }, bot.locale);

        kcgmm.fetch('cw4').catch(logger.error);
        kcgmm.fetch('pf').catch(logger.error);
        kcgmm.fetch('cw3').catch(logger.error);
        kcgmm.fetch('cw2').catch(logger.error);
        
        setInterval(() => {
            kcgmm.fetch('cw4').catch(logger.error);
            kcgmm.fetch('pf').catch(logger.error);
            kcgmm.fetch('cw3').catch(logger.error);
            kcgmm.fetch('cw2').catch(logger.error);
        }, 1000 * 60 * 60 * 24);

        core.addCommand(['roll', 'dice', 'die'], null, 'misc', 'EVERYONE', (m, args, arg) => {
            let param = Number(args[0]);
            let sides = Number.isNaN(param) ? 6 : param;
            let roll = Bot.Util.getRandomInt(1, sides + 1);

            m.message.reply(`[:game_die: D${sides}] rolled \`${roll}\`!`).catch(logger.error);
        });

        core.getModule((await import('./src/modules/Emotes.js')).default).then(emotes => {
            core.addCommand("emote", null, "admin", "MODERATOR", (message, args, arg) => {
                return emotes.emote(message, args, arg, {});
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/EventLog.js')).default).then(eventlog => {
            core.addCommand("channel", ["eventlog", "e"], "admin", null, (message, args, arg) => {
                return eventlog.setChannel(message, args, arg, { type: 'event' });
            });
            core.addCommand("channel", ["imagelog", "e"], "admin", null, (message, args, arg) => {
                return eventlog.setChannel(message, args, arg, { type: 'image' });
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Map.js')).default).then(map => {
            core.addCommand('map', null, 'misc', 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return map.get(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(['score', 'scores'], null, 'misc', 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return map.score(message, args, arg, { kcgmm: kcgmm });
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Experience.js')).default).then(experience => {
            core.addCommand(['exp', 'experience'], null, ['experience', 'exp'], 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return experience.info(message, args, arg, {kcgmm: kcgmm});
            });
            core.addCommand(['exp', 'experience'], 'register', ['experience', 'exp'], 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return experience.register(message, args, arg, {});
            });
            core.addCommand(['exp', 'experience'], ['show', 'profile'], ['experience', 'exp'], 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return experience.exp(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(['exp', 'experience'], ['get', 'claim', 'new'], ['experience', 'exp'], 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return experience.get(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(['exp', 'experience'], ['leaders', 'leaderboard', 'leaderboards'], ['experience', 'exp'], 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return experience.leaderboard(message, args, arg, {});
            });
            core.addCommand(['exp', 'experience'], 'wipe', ['experience', 'exp'], null, (message, args, arg) => {
                return experience.wipe(message, args, arg, {});
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Stream.js')).default).then(stream => {
            core.addCommand("stream", null, ["stream", "streamer"], null, (message, args, arg) => {
                return stream.info(message, args, arg, {});
            });
            core.addCommand("channel", "stream", "admin", null, (message, args, arg) => {
                return stream.setChannel(message, args, arg, {});
            });
            core.addCommand("stream", ["addgame", "add"], ["stream", "streamer"], null, (message, args, arg) => {
                return stream.add(message, args, arg, {});
            });
            core.addCommand("stream", ["sub", "subscribe"], ["stream", "streamer"], "CITIZEN_OF_ODIN", (message, args, arg) => {
                return stream.subscribe(message, args, arg, {});
            });
            core.addCommand("stream", ["unsub", "unsubscribe"], ["stream", "streamer"], "CITIZEN_OF_ODIN", (message, args, arg) => {
                return stream.unsubscribe(message, args, arg, {});
            });
            core.addCommand("stream", "start", ["stream", "streamer"], "STREAMER", (message, args, arg) => {
                return stream.start(message, args, arg, {});
            });
            core.addCommand("stream", "end", ["stream", "streamer"], "STREAMER", (message, args, arg) => {
                return stream.end(message, args, arg, {});
            });
            core.addCommand("stream", "status", ["stream", "streamer"], "CITIZEN_OF_ODIN", (message, args, arg) => {
                return stream.status(message, args, arg, {});
            });
            core.addCommand("stream", ["sync", "synchronize"], ["stream", "streamer"], null, (message, args, arg) => {
                return stream.synchronize(message, args, arg, {});
            });
        }).catch(console.error);

        core.getModule((await import('./src/modules/Competition.js')).default).then(competition => {
            core.addLoop(1000 * 60 * 30, (guild) => {
                competition.loop(guild, { kcgmm: kcgmm });
            });
            core.addCommand('channel', 'competition', 'admin', null, (message, args, arg) => {
                return competition.setChannel(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], null, ['competition', 'c'], 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return competition.info(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], 'join', ['competition', 'c'], 'CITIZEN_OF_ODIN', (message, args, arg) => {
                return competition.join(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], 'leave', ['competition', 'c'], 'COMPETITOR', (message, args, arg) => {
                return competition.leave(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], 'register', ['competition', 'c'], 'COMPETITOR', (message, args, arg) => {
                return competition.register(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], 'update', ['competition', 'c'], 'COMPETITOR', (message, args, arg) => {
                return competition.update(message, args, arg, {kcgmm: kcgmm});
            });
            core.addCommand(['c', 'competition'], 'status', ['competition', 'c'], 'COMPETITOR', (message, args, arg) => {
                return competition.status(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], 'start', ['competition', 'c'], 'EVENT_MOD', (message, args, arg) => {
                return competition.start(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], ['addmap', 'add'], ['competition', 'c'], 'EVENT_MOD', (message, args, arg) => {
                return competition.addMap(message, args, arg, {type: 'add', kcgmm: kcgmm});
            });
            core.addCommand(['c', 'competition'], ['removemap', 'remove'], ['competition', 'c'], 'EVENT_MOD', (message, args, arg) => {
                return competition.addMap(message, args, arg, {type: 'remove', kcgmm: kcgmm});
            });
            core.addCommand(['c', 'competition'], 'end', ['competition', 'c'], 'EVENT_MOD', (message, args, arg) => {
                return competition.end(message, args, arg, {kcgmm: kcgmm});
            });
            core.addCommand(['c', 'competition'], 'buildtally', ['competition', 'c'], 'EVENT_MOD', (message, args, arg) => {
                return competition.buildTally(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], 'destroy', ['competition', 'c'], 'EVENT_MOD', (message, args, arg) => {
                return competition.destroy(message, args, arg, {});
            });
            core.addCommand(['c', 'competition'], 'wipe', ['competition', 'c'], 'EVENT_MOD', (message, args, arg) => {
                return competition.unregister(message, args, arg, {});
            });
        }).catch(logger.error);

    })().catch(logger.error);
});