'use strict';

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';

const logger = Bot.logger;
import { KCGameMapManager } from './src/kc/KCGameMapManager.js'; 

const core = new Bot.Core({
    dbName: 'lia_bot',
    intents: [
        Discord.IntentsBitField.Flags.Guilds,
        Discord.IntentsBitField.Flags.GuildMembers,
        Discord.IntentsBitField.Flags.GuildModeration,
        Discord.IntentsBitField.Flags.GuildEmojisAndStickers,
        Discord.IntentsBitField.Flags.GuildIntegrations,
        Discord.IntentsBitField.Flags.GuildWebhooks,
        Discord.IntentsBitField.Flags.GuildInvites,
        Discord.IntentsBitField.Flags.GuildVoiceStates,
        Discord.IntentsBitField.Flags.GuildPresences,
        Discord.IntentsBitField.Flags.GuildMessages,
        Discord.IntentsBitField.Flags.GuildMessageReactions,
        Discord.IntentsBitField.Flags.GuildMessageTyping,
        Discord.IntentsBitField.Flags.DirectMessages,
        Discord.IntentsBitField.Flags.DirectMessageReactions,
        Discord.IntentsBitField.Flags.DirectMessageTyping,
        Discord.IntentsBitField.Flags.MessageContent
    ]
});

core.on('ready', bot => {
    (async () => {
        let kcgmm = new KCGameMapManager({
            cacheTimeCW2: 1000 * 60 * 60 * 24
        }, bot.locale);

        /** @type {import('./src/modules/CWMaps').default} */
        const cwMaps = await core.getModule((await import('./src/modules/CWMaps.js')).default);

        await kcgmm.fetch('cw4').catch(logger.error);
        await Bot.Util.Promise.sleep(1000);
        await kcgmm.fetch('pf').catch(logger.error);
        await Bot.Util.Promise.sleep(1000);
        await kcgmm.fetch('cw3').catch(logger.error);
        
        await cwMaps.updateCW1Maps(kcgmm);
        await cwMaps.updateCW2Maps(kcgmm);
        (async () => {
            await Bot.Util.Promise.sleep(1000);
            await kcgmm.readCacheCW2().catch(async e => {
                logger.error(e);
                await Bot.Util.Promise.sleep(1000);
                //await kcgmm.fetch('cw2').catch(logger.error);
            });
            await Bot.Util.Promise.sleep(1000);
            await cwMaps.start(kcgmm, 'cw2').catch(logger.error);

            await Bot.Util.Promise.sleep(1000);
            await kcgmm.readCacheCW1().catch(async e => {
                logger.error(e);
                await Bot.Util.Promise.sleep(1000);
                //await kcgmm.fetch('cw1').catch(logger.error);
            });
            await Bot.Util.Promise.sleep(1000);
            await cwMaps.start(kcgmm, 'cw1').catch(logger.error);
            

            logger.info("Initializing map lists finished.");
            setInterval(async () => {
                await kcgmm.fetch('cw4').catch(logger.error);
                await Bot.Util.Promise.sleep(1000);
                await kcgmm.fetch('pf').catch(logger.error);
                await Bot.Util.Promise.sleep(1000);
                await kcgmm.fetch('cw3').catch(logger.error);
                /* core.call(guild => { autopost.loop(guild); }); */
            }, 1000 * 60 * 60 * 24);
            setInterval(async () => {
                //await Bot.Util.Promise.sleep(1000);
                //await kcgmm.fetch('cw2').catch(logger.error);
                //await Bot.Util.Promise.sleep(1000);
                //await cwMaps.start(kcgmm, 'cw2').catch(logger.error);
                await Bot.Util.Promise.sleep(1000);
                await kcgmm.fetch('cw1').catch(logger.error);
                await Bot.Util.Promise.sleep(1000);
                await cwMaps.start(kcgmm, 'cw1').catch(logger.error);
            }, 1000 * 60 * 60 * 24 * 7);
        })();

        /** @type {import('./src/modules/Map.js').default} */
        const map = await core.getModule((await import('./src/modules/Map.js')).default);
        /** @type {import('./src/modules/Stream.js').default} */
        const stream = await core.getModule((await import('./src/modules/Stream.js')).default);
        /** @type {import('./src/modules/Champion.js').default} */
        const champion = await core.getModule((await import('./src/modules/Champion.js')).default);
        /** @type {import('./src/modules/Wiki.js').default} */
        const wiki = await core.getModule((await import('./src/modules/Wiki.js')).default);
        /** @type {import('./src/modules/HurtHeal.js').default} */
        const hurtheal = await core.getModule((await import('./src/modules/HurtHeal.js')).default);
        /** @type {import('./src/modules/Competition.js').default} */
        const competition = await core.getModule((await import('./src/modules/Competition.js')).default);
        /** @type {import('./src/modules/Experience.js').default} */
        const experience = await core.getModule((await import('./src/modules/Experience.js')).default);
        /** @type {import('./src/modules/Chronom.js').default} */
        const chronom = await core.getModule((await import('./src/modules/Chronom.js')).default);
        /** @type {import('./src/modules/Emotes.js').default} */
        const emotes = await core.getModule((await import('./src/modules/Emotes.js')).default);
        /** @type {import('./src/modules/Farkle.js').default} */
        const farkle = await core.getModule((await import('./src/modules/Farkle.js')).default);
        /** @type {import('./src/modules/DMD.js').default} */
        const dmd = await core.getModule((await import('./src/modules/DMD.js')).default);
        /** @type {import('./src/modules/AutoPost.js').default} */
        const autopost = await core.getModule((await import('./src/modules/AutoPost.js')).default);

        map.kcgmm = kcgmm;
        map.dmd = dmd;
        chronom.kcgmm = kcgmm;
        experience.kcgmm = kcgmm;
        experience.champion = champion;
        competition.kcgmm = kcgmm;
        competition.champion = champion;
        competition.map = map;
        competition.dmd = dmd;
        autopost.map = map;
        autopost.kcgmm = kcgmm;

        /* core.call(guild => { autopost.loop(guild); }); */

        setTimeout(() => {
            core.addLoop(1000 * 60 * 48, guild => { experience.loop(guild, kcgmm, champion); });
        }, 12000);
        setTimeout(() => {
            core.addLoop(1000 * 60 * 5, guild => { hurtheal.loop(guild); });
        }, 20000);
        setTimeout(() => {
            core.addLoop(1000 * 60 * 27, guild => { chronom.loop(guild, kcgmm); });
        }, 5000);
        setTimeout(() => {
            core.addLoop(1000 * 60 * 14, guild => { competition.loop(guild, kcgmm, champion); });
        }, 8000);


        (() => {
            const obj = {
                categoryNames: [':game_die: Miscellaneous', 'miscellaneous', 'misc']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'map', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'map');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['score', 'scores'], commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'score');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['bestof', 'month'], commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'bestof');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'stream', commandNames: 'setchannel', authorityLevel: null}), (message, args, arg) => {
                unsupportedMessage(message.message, 'stream setchannel');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'stream', commandNames: ['', 'start'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'stream start');
            });

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'crpl', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'crpl');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'prpl', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'prpl');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: '4rpl', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, '4rpl');
            });
        })();

        (() => {
            const obj = { categoryNames: [':video_game: Hurt or Heal', 'hurt or heal', 'hurt heal', 'hh'] }
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh show');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: ['rules', 'info'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh rules');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'hurt', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh hurt');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'heal', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh heal');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'start', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh start');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'theme', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh theme');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'end', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh end');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'chart', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh chart');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'list', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                unsupportedMessage(message.message, 'hh list');
            });
        })();

        (() => {
            const obj = {
                categoryNames: [':video_game: Farkle', 'farkle', 'f']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['setchannel'], authorityLevel: null}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f setchannel');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['solo'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f solo');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['host', 'h'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f host');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['leave', 'l'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f leave');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['join', 'j'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f join');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['start', 's'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f start');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'skin', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f skin');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'games', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f games');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'profile', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f profile');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'spectate', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f spectate');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'rules', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'f rules');
            });

        })();
        
        (() => {
            core.addCommand({baseNames: 'emote', commandNames: null, categoryNames: [':diamond_shape_with_a_dot_inside: Core', 'core'], authorityLevel: 'MODERATOR'}, (message, args, arg) => {
                unsupportedMessage(message.message, 'emote');
            });
        })();

        (() => {
            const obj = {
                baseNames: ['exp', 'experience'],
                categoryNames: [':joystick: Experience', 'experience', 'exp']
            }
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp info');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'register', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp register');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['profile', 'show'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp profile');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['new', 'claim', 'get'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp new');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['leaders', 'leaderboard', 'leaderboards'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp leaderboard');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'rename', authorityLevel: 'MODERATOR'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp rename');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'ignore', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp ignore');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'unignore', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp unignore');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'ignorelist', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp ignorelist');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'message', authorityLevel: 'MODERATOR'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'exp message');
            });
        })();

        (() => {
            const obj = {
                baseNames: ['c', 'competition'],
                categoryNames: [':trophy: Competition', 'competition', 'c']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'chronom', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'chronom');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c info');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'setchannel', authorityLevel: null}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c setchannel');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'register', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c register');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'update', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c update');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'start', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c start');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['addmap', 'add'], authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c addmap');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: ['removemap', 'remove'], authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c removemap');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'end', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c end');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'buildtally', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c buildtally');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'destroy', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c destroy');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'wipe', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c unregister');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'map', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c map');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'intro', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c intro');
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'pinmania', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                unsupportedMessage(message.message, 'c pinmania');
            });
        })();

        (() => {
            const strings = [
                { v: 'Watching over Skars',      minMins: 60, maxMins: 120 },
                { v: '[Gel maintenance]',       minMins: 30, maxMins: 60 },
                { v: 'Drifting through space',  minMins: 30, maxMins: 60 },
                { v: 'Maintaining ship',        minMins: 15, maxMins: 30 },
                { v: 'Installing OS updates',   minMins: 15, maxMins: 30 },
                { v: 'Anticipating destiny',    minMins: 15, maxMins: 30 },
                { v: 'Monitoring Earth',        minMins: 15, maxMins: 30 }
            ];

            let update = () => {
                let obj = strings[Bot.Util.getRandomInt(0, strings.length)];
                setTimeout(update, Bot.Util.getRandomInt(1000 * 60 * obj.minMins, 1000 * 60 * obj.maxMins));

                if(core.client.user == null) return;
                core.client.user.setActivity({
                    type: Discord.ActivityType.Playing,
                    name: `| ${obj.v}`
                });
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

/**
 * 
 * @param {Discord.Message} m 
 * @param {string} str
 */
function unsupportedMessage(m, str) {
    m.reply(`I am now using slash commands! You can use this command with \`/${str}\``).then(message => {
        setTimeout(() => {
            m.delete();
            message.delete();
        }, 15000)
    }).catch(logger.error);
}