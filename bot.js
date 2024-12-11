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

        await kcgmm.fetch('ixe').catch(logger.error);
        await Bot.Util.Promise.sleep(1000);
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
                // core.call(guild => { autopost.loop(guild); });
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