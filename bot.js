'use strict';

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCGameMapManager } from './src/kc/KCGameMapManager.js'; 

const core = new Bot.Core('371018033298276353');

core.on('ready', bot => {
    (async () => {
        let kcgmm = new KCGameMapManager({
            disableCW2: false
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

        /** @type {import('./src/modules/Map.js').default} */
        const map = await core.getModule((await import('./src/modules/Map.js')).default);
        (() => {
            const obj = {
                categoryNames: [':game_die: Miscellaneous', 'miscellaneous', 'misc']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'map', commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return map.land(message, args, arg, { action: 'map', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['score', 'scores'], commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return map.land(message, args, arg, { action: 'score', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['bestof', 'month'], commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return map.land(message, args, arg, { action: 'bestof', kcgmm: kcgmm });
            });
        })();


        core.getModule((await import('./src/modules/Emotes.js')).default).then(emotes => {
            core.addCommand({baseNames: 'emote', commandNames: null, categoryNames: [':diamond_shape_with_a_dot_inside: Core', 'core'], authorityLevel: 'MODERATOR'}, (message, args, arg) => {
                return emotes.emote(message, args, arg, {});
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
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['profile', 'show'], authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.exp(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['new', 'claim', 'get'], authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.get(message, args, arg, { kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['leaders', 'leaderboard', 'leaderboards'], authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return experience.leaderboard(message, args, arg, { kcgmm: kcgmm });
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

            core.addLoop(1000 * 60 * 30, guild => {
                competition.loop(guild, kcgmm);
            });

            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'CITIZEN_OF_ODIN'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'info' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'setchannel', authorityLevel: null}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'set-channel' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'register', authorityLevel: 'COMPETITOR'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'register' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'update', authorityLevel: 'COMPETITOR'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'update', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'status', authorityLevel: 'COMPETITOR'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'status' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'start', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'start' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['addmap', 'add'], authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'add-map', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['removemap', 'remove'], authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'remove-map', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'end', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'end', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'buildtally', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'build-tally' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'destroy', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'destroy' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'wipe', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'unregister' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'map', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'map', kcgmm: kcgmm, map: map });
            });
        }).catch(logger.error);

        (() => {
            const strings = [
                '[Gel maintenance]',
                'Drifting through space',
                'Looking over Skars',
                'Maintaining ship',
                'Installing OS updates',
                'Anticipating destiny',
                'Monitoring Earth'
            ]
            let update = () => {
                core.client.setTimeout(update, Bot.Util.getRandomInt(1000 * 60 * 15, 1000 * 60 * 45));

                if(core.client.user == null) return;
    
                core.client.user.setActivity({
                    type: 'PLAYING',
                    name: `| ${strings[Bot.Util.getRandomInt(0, strings.length)]}`
                }).catch(logger.error);
            }
            update();
        })();
    })().catch(logger.error);
});