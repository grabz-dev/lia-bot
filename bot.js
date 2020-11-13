'use strict';

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCGameMapManager } from './src/kc/KCGameMapManager.js'; 

const core = new Bot.Core('371018033298276353');

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

        core.addCommand({baseNames: ['roll', 'dice', 'die'], commandNames: null, categoryNames: [':game_die: Miscellaneous', 'miscellaneous', 'misc'], authorityLevel: 'EVERYONE'}, (m, args, arg) => {
            let param = Number(args[0]);
            let sides = Number.isNaN(param) ? 6 : param;
            let roll = Bot.Util.getRandomInt(1, sides + 1);

            m.message.reply(`[:game_die: D${sides}] rolled \`${roll}\`!`).catch(logger.error);
        });

        core.getModule((await import('./src/modules/Emotes.js')).default).then(emotes => {
            core.addCommand({baseNames: 'emote', commandNames: null, categoryNames: [':diamond_shape_with_a_dot_inside: Core', 'core'], authorityLevel: 'MODERATOR'}, (message, args, arg) => {
                return emotes.emote(message, args, arg, {});
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Map.js')).default).then(map => {
            const obj = {
                categoryNames: [':game_die: Miscellaneous', 'miscellaneous', 'misc']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'map', commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return map.get(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['score', 'scores'], commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return map.score(message, args, arg, { kcgmm: kcgmm });
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Experience.js')).default).then(experience => {
            const obj = {
                baseNames: ['exp', 'experience'],
                categoryNames: [':joystick: Experience', 'experience', 'exp']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.info(message, args, arg, {kcgmm: kcgmm});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'register', authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.register(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['show', 'profile'], authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.exp(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['get', 'claim', 'new'], authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.get(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['leaders', 'leaderboard', 'leaderboards'], authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.leaderboard(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'wipe', authorityLevel: null}), (message, args, arg) => {
                return experience.wipe(message, args, arg, {});
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Stream.js')).default).then(stream => {
            const obj = {
                baseNames: 'stream',
                categoryNames: [':clapper: Stream', 'stream', 'streamer']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'info' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'setchannel', authorityLevel: null}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'set-channel' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['addgame', 'add'], authorityLevel: null}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'add-game' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'start', authorityLevel: 'STREAMER'}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'start' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'end', authorityLevel: 'STREAMER'}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'end' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'status', authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'status' });
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Competition.js')).default).then(competition => {
            const obj = {
                baseNames: ['c', 'competition'],
                categoryNames: [':trophy: Competition', 'competition', 'c']
            }

            core.addLoop(1000 * 60 * 30, (guild) => {
                competition.loop(guild, { kcgmm: kcgmm });
            });

            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return competition.info(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'setchannel', authorityLevel: null}), (message, args, arg) => {
                return competition.setChannel(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'register', authorityLevel: 'COMPETITOR'}), (message, args, arg) => {
                return competition.register(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'update', authorityLevel: 'COMPETITOR'}), (message, args, arg) => {
                return competition.update(message, args, arg, {kcgmm: kcgmm});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'status', authorityLevel: 'COMPETITOR'}), (message, args, arg) => {
                return competition.status(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'start', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.start(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['addmap', 'add'], authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.addMap(message, args, arg, {type: 'add', kcgmm: kcgmm});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['removemap', 'remove'], authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.addMap(message, args, arg, {type: 'remove', kcgmm: kcgmm});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'end', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.end(message, args, arg, {kcgmm: kcgmm});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'buildtally', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.buildTally(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'destroy', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.destroy(message, args, arg, {});
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'wipe', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.unregister(message, args, arg, {});
            });
        }).catch(logger.error);

    })().catch(logger.error);
});