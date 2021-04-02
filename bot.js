'use strict';

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCGameMapManager } from './src/kc/KCGameMapManager.js'; 

const core = new Bot.Core('371018033298276353', 'lia_bot');

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
        }, 1000 * 60 * 60 * 6);
        setInterval(() => {
            kcgmm.fetch('cw2').catch(logger.error);
        }, 1000 * 60 * 60 * 24);

        /** @type {import('./src/modules/Map.js').default} */
        const map = await core.getModule((await import('./src/modules/Map.js')).default);
        /** @type {import('./src/modules/Stream.js').default} */
        const stream = await core.getModule((await import('./src/modules/Stream.js')).default);
        /** @type {import('./src/modules/Champion.js').default} */
        const champion = await core.getModule((await import('./src/modules/Champion.js')).default);
        /** @type {import('./src/modules/Wiki.js').default} */
        const wiki = await core.getModule((await import('./src/modules/Wiki.js')).default);
        (() => {
            const obj = {
                categoryNames: [':game_die: Miscellaneous', 'miscellaneous', 'misc']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['roll', 'dice', 'die'], commandNames: null, authorityLevel: 'EVERYONE'}), (m, args, arg) => {
                let param = Number(args[0]);
                let sides = Number.isNaN(param) ? 6 : param;
                let roll = Bot.Util.getRandomInt(1, sides + 1);
    
                m.message.reply(`[:game_die: D${sides}] rolled \`${roll}\`!`).catch(logger.error);
            });

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'map', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return map.land(message, args, arg, { action: 'map', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['score', 'scores'], commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return map.land(message, args, arg, { action: 'score', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['bestof', 'month'], commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return map.land(message, args, arg, { action: 'bestof', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'stream', commandNames: 'setchannel', authorityLevel: null}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'set-channel' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'stream', commandNames: ['', 'start'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return stream.land(message, args, arg, { action: 'start' });
            });

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'crpl', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return wiki.land(message, args, arg, { action: 'crpl' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'prpl', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return wiki.land(message, args, arg, { action: 'prpl' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: '4rpl', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return wiki.land(message, args, arg, { action: '4rpl' });
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

            setTimeout(() => {
                core.addLoop(1000 * 60 * 27, guild => {
                    experience.loop(guild, kcgmm, champion);
                });
            }, 9000);

            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'info', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'register', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'register' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['profile', 'show'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'profile', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['new', 'claim', 'get'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'new', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['leaders', 'leaderboard', 'leaderboards'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'leaderboard', kcgmm: kcgmm, champion: champion });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'wipe', authorityLevel: null}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'wipe' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'ignore', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'ignore' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'unignore', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'unignore' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'ignorelist', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'ignorelist' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'message', authorityLevel: 'MODERATOR'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'message', kcgmm: kcgmm, champion: champion });
            });
        }).catch(logger.error);

        core.getModule((await import('./src/modules/Competition.js')).default).then(async competition => {
            const obj = {
                baseNames: ['c', 'competition'],
                categoryNames: [':trophy: Competition', 'competition', 'c']
            }

            core.getModule((await import('./src/modules/Chronom.js')).default).then(chronom => {
                setTimeout(() => {
                    core.addLoop(1000 * 60 * 49, guild => {
                        chronom.loop(guild, kcgmm);
                    });
                }, 5000);
                core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'chronom', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                    return chronom.land(message, args, arg, { action: 'chronom', kcgmm: kcgmm });
                });
            }).catch(logger.error);

            setTimeout(() => {
                core.addLoop(1000 * 60 * 27, guild => {
                    competition.loop(guild, kcgmm);
                });
            }, 5000);
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'info' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'setchannel', authorityLevel: null}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'set-channel' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'register', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'register' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'update', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'update', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'status', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
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
                return competition.land(message, args, arg, { action: 'end', kcgmm: kcgmm, champion: champion });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'buildtally', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'build-tally', champion: champion });
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
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'intro', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'intro' });
            });
        }).catch(logger.error);

        (() => {
            const strings = [
                { v: 'Looking over Skars',      minMins: 60, maxMins: 120 },
                { v: '[Gel maintenance]',       minMins: 30, maxMins: 60 },
                { v: 'Drifting through space',  minMins: 30, maxMins: 60 },
                { v: 'Maintaining ship',        minMins: 15, maxMins: 30 },
                { v: 'Installing OS updates',   minMins: 15, maxMins: 30 },
                { v: 'Anticipating destiny',    minMins: 15, maxMins: 30 },
                { v: 'Monitoring Earth',        minMins: 15, maxMins: 30 }
            ];

            let update = () => {
                let obj = strings[Bot.Util.getRandomInt(0, strings.length)];
                core.client.setTimeout(update, Bot.Util.getRandomInt(1000 * 60 * obj.minMins, 1000 * 60 * obj.maxMins));

                if(core.client.user == null) return;
                core.client.user.setActivity({
                    type: 'PLAYING',
                    name: `| ${obj.v}`
                }).catch(logger.error);
            }
            update();
        })();
    })().catch(logger.error);
});

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // @ts-ignore
    console.dir(reason.stack);
});