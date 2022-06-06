'use strict';

import Discord from 'discord.js';
import * as Bot from 'discord-bot-core';
const logger = Bot.logger;
import { KCGameMapManager } from './src/kc/KCGameMapManager.js'; 

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { SlashCommandBuilder } from '@discordjs/builders';

const core = new Bot.Core({
    dbName: 'lia_bot',
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_BANS,
        Discord.Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Discord.Intents.FLAGS.GUILD_INTEGRATIONS,
        Discord.Intents.FLAGS.GUILD_WEBHOOKS,
        Discord.Intents.FLAGS.GUILD_INVITES,
        Discord.Intents.FLAGS.GUILD_VOICE_STATES,
        Discord.Intents.FLAGS.GUILD_PRESENCES,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Discord.Intents.FLAGS.GUILD_MESSAGE_TYPING,
        Discord.Intents.FLAGS.DIRECT_MESSAGES,
        Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
        Discord.Intents.FLAGS.DIRECT_MESSAGE_TYPING,
    ]
});

const choices = {
    game: [
        { name: 'Creeper World 4', value: 'cw4' },
        { name: 'Particle Fleet',  value: 'pf' },
        { name: 'Creeper World 3', value: 'cw3' },
        { name: 'Creeper World 2', value: 'cw2' },
        { name: 'Creeper World 1', value: 'cw' }
    ]
}

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
                await kcgmm.fetch('cw2').catch(logger.error);
            });
            await Bot.Util.Promise.sleep(1000);
            await cwMaps.start(kcgmm, 'cw2').catch(logger.error);

            await Bot.Util.Promise.sleep(1000);
            await kcgmm.readCacheCW1().catch(async e => {
                logger.error(e);
                await Bot.Util.Promise.sleep(1000);
                await kcgmm.fetch('cw1').catch(logger.error);
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
            }, 1000 * 60 * 60 * 6);
            setInterval(async () => {
                await Bot.Util.Promise.sleep(1000);
                await kcgmm.fetch('cw2').catch(logger.error);
                await Bot.Util.Promise.sleep(1000);
                await cwMaps.start(kcgmm, 'cw2').catch(logger.error);
                await Bot.Util.Promise.sleep(1000);
                await kcgmm.fetch('cw1').catch(logger.error);
                await Bot.Util.Promise.sleep(1000);
                await cwMaps.start(kcgmm, 'cw1').catch(logger.error);
            }, 1000 * 60 * 60 * 96);
        })();

        /** @type {import('./src/modules/Map.js').default} */
        const map = await core.getModule((await import('./src/modules/Map.js')).default);
        map.manualInit(kcgmm);
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

        (() => {
            const obj = {
                categoryNames: [':game_die: Miscellaneous', 'miscellaneous', 'misc']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['roll', 'dice', 'die'], commandNames: null, authorityLevel: 'EVERYONE'}), (m, args, arg) => {
                let param = Number(args[0]);
                let sides = Number.isNaN(param) ? 6 : param;
                let roll = Bot.Util.getRandomInt(0, sides) + 1;
    
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

        (() => {
            const obj = {
                categoryNames: [':video_game: Hurt or Heal', 'hurt or heal', 'hurt heal', 'hh']
            }

            setTimeout(() => {
                core.addLoop(1000 * 60 * 5, guild => {
                    hurtheal.loop(guild);
                });
            }, 20000);

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: null, authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'show' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: ['rules', 'info'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'help' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'hurt', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'hurt' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'heal', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'heal' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'start', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'start' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'theme', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'theme' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'end', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'end' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'chart', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'chart' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: 'hh', commandNames: 'list', authorityLevel: ['MODERATOR', 'EMERITUS_MODERATOR']}), (message, args, arg) => {
                return hurtheal.land(message, args, arg, { action: 'list' });
            });
        })();

        core.getModule((await import('./src/modules/Farkle.js')).default).then(farkle => {
            const obj = {
                categoryNames: [':video_game: Farkle', 'farkle', 'f']
            }

            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['setchannel'], authorityLevel: null}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'setchannel' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['solo'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'solo' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['host', 'h'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'host' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['leave', 'l'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'leave' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['join', 'j'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'join' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: ['start', 's'], authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'start' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'skin', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'skin' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'games', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'games' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'profile', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'profile' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'spectate', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'spectate' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {baseNames: ['f', 'farkle'], commandNames: 'rules', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return farkle.land(message, args, arg, { action: 'rules' });
            });

        }).catch(logger.error);
        

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
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'rename', authorityLevel: 'MODERATOR'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'rename' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'ignore', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'ignore', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'unignore', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'unignore', kcgmm: kcgmm });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'ignorelist', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'ignorelist' });
            });
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'message', authorityLevel: 'MODERATOR'}), (message, args, arg) => {
                return experience.land(message, args, arg, { action: 'message', kcgmm: kcgmm, champion: champion });
            });
        }).catch(logger.error);

        (async () => {
            const obj = {
                baseNames: ['c', 'competition'],
                categoryNames: [':trophy: Competition', 'competition', 'c']
            }

            core.getModule((await import('./src/modules/Chronom.js')).default).then(chronom => {
                setTimeout(() => {
                    core.addLoop(1000 * 60 * 27, guild => {
                        chronom.loop(guild, kcgmm);
                    });
                }, 5000);
                core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'chronom', authorityLevel: 'EVERYONE'}), (message, args, arg) => {
                    return chronom.land(message, args, arg, { action: 'chronom', kcgmm: kcgmm });
                });
            }).catch(logger.error);

            setTimeout(() => {
                core.addLoop(1000 * 60 * 14, guild => {
                    competition.loop(guild, kcgmm, champion);
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
            core.addCommand(Object.assign(Object.assign({}, obj), {commandNames: 'pinmania', authorityLevel: 'EVENT_MOD'}), (message, args, arg) => {
                return competition.land(message, args, arg, { action: 'pinmania' });
            });
        })().catch(logger.error);

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
                setTimeout(update, Bot.Util.getRandomInt(1000 * 60 * obj.minMins, 1000 * 60 * obj.maxMins));

                if(core.client.user == null) return;
                core.client.user.setActivity({
                    type: 'PLAYING',
                    name: `| ${obj.v}`
                });
            }
            update();
        })();

        //Receive slash commands
        bot.client.on('interactionCreate', async interaction => {
            if(!interaction.isCommand()) return;
            if(!interaction.inCachedGuild()) return;

            if(interaction.guild == null || 
               !(interaction.member instanceof Discord.GuildMember) ||
               !(interaction.channel instanceof Discord.TextChannel || interaction.channel instanceof Discord.ThreadChannel)) {
                await interaction.reply({ content: 'This interaction is unsupported.' });
                return;
            }

            let forcePermit = false;
            if(Bot.Util.isMemberAdmin(interaction.member) || interaction.member.id === bot.fullAuthorityOverride) {
                forcePermit = true;
            }

            switch(interaction.commandName) {
                case 'competition':
                case 'competition_admin':
                case 'competition_mod': {
                    if(!forcePermit && !competition.interactionPermitted(interaction, interaction.guild, interaction.member)) {
                        interaction.reply({ content: 'You are not permitted to use this command.', ephemeral: true }).catch(logger.error);
                        break;
                    }
                    competition.incomingInteraction(interaction, interaction.guild, interaction.member, interaction.channel, { kcgmm, champion, map }).catch(logger.error);
                    break;
                }
                case 'map': {
                    if(!forcePermit && !map.interactionPermitted(interaction, interaction.guild, interaction.member)) {
                        interaction.reply({ content: 'You are not permitted to use this command.', ephemeral: true }).catch(logger.error);
                        break;
                    }
                    map.incomingInteraction(interaction, interaction.guild, interaction.member, interaction.channel, { kcgmm }).catch(logger.error);
                    break;
                }
            }
        });

        (async () => {
            if(bot.client.user == null) return;
            const clientId = bot.client.user.id;

            const commands = [
                new SlashCommandBuilder()
                .setName('map')
                .setDescription('Display information about a map.')
                .addSubcommand(subcommand =>
                    subcommand.setName('id')
                        .setDescription('Display information about a map, searching by ID.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('Choose the game the map is from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        )
                        .addIntegerOption(option =>
                            option.setName('id')
                                .setDescription('The map ID number.')
                                .setRequired(true)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('title')
                        .setDescription('Display information about a map, searching by map title.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('Choose the game the map is from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        )
                        .addStringOption(option =>
                            option.setName('title')
                                .setDescription('The full or partial map title to search (case insensitive).')
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName('author')
                                .setDescription('The name of the map author (case insensitive).')
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('random')
                        .setDescription('Display information about a map, choosing a random one.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('Choose the game to pick randomly from. Omit to also pick a random game.')
                                .addChoices(...choices.game)
                        )
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('competition')
                .setDescription('Collection of Competition related commands.')
                .addSubcommand(subcommand =>
                    subcommand.setName('info')
                        .setDescription('View information about the Competition.')
                ).addSubcommand(subcommand =>
                    subcommand.setName('register')
                        .setDescription('Register your in-game name for Competition related bot features.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('Choose the game you wish to register your in-game name for.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        )
                        .addStringOption(option =>
                            option.setName('username')
                                .setDescription('The name you use on the in-game leaderboards. Case sensitive!')
                                .setRequired(true)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('update')
                        .setDescription('Force a manual update of the Competition score standings.')
                ).toJSON(),
                new SlashCommandBuilder()
                    .setName('competition_admin')
                    .setDescription('[Admin] Collection of Competition related commands.')
                    .setDefaultMemberPermissions('0')
                    .addSubcommand(subcommand =>
                        subcommand.setName('setchannel')
                            .setDescription('[Admin] Set the competition channel.')
                ).toJSON(),
                new SlashCommandBuilder()
                    .setName('competition_mod')
                    .setDescription('[Mod] Collection of Competition related commands.')
                    .setDefaultMemberPermissions('0')
                    .addSubcommand(subcommand =>
                        subcommand.setName('unregister')
                            .setDescription('[Mod] Remove a user\'s Competition registration entries.')
                            .addUserOption(option => 
                                option.setName('user')
                                    .setDescription('The user to unregister from the Competition.')
                                    .setRequired(true)
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('start')
                            .setDescription('[Mod] Start a new Competition.')
                            .addStringOption(option => 
                                option.setName('date')
                                    .setDescription('The end date for the Competition. Example date format: 2022-06-04')
                                    .setRequired(true)
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('destroy')
                            .setDescription('[Mod] Erase the current Competition as if it never happened.')
                    ).addSubcommand(subcommand =>
                        subcommand.setName('add_map')
                            .setDescription('[Mod] Add a map to the current Competition.')
                            .addStringOption(option =>
                                option.setName('game')
                                    .setDescription('Choose the game to add the map from.')
                                    .setRequired(true)
                                    .addChoices(...choices.game)    
                            ).addStringOption(option =>
                                option.setName('parameters')
                                    .setDescription('"custom 1234 nullify" "code small medium abc" "markv totems abc#1444"')
                                    .setRequired(true)
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('remove_map')
                            .setDescription('[Mod] Remove a map from the current Competition.')
                            .addStringOption(option =>
                                option.setName('game')
                                    .setDescription('Choose the game of the map.')
                                    .setRequired(true)
                                    .addChoices(...choices.game)    
                            ).addStringOption(option =>
                                option.setName('parameters')
                                    .setDescription('"custom 1234 nullify" "code small medium abc" "markv totems abc#1444"')
                                    .setRequired(true)
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('end')
                            .setDescription('[Mod] End the current Competition early, before the schedule.')
                    ).addSubcommand(subcommand =>
                        subcommand.setName('map')
                            .setDescription('[Mod] Check if a map was already featured before, or pick a map at random.')
                            .addStringOption(option =>
                                option.setName('game')
                                    .setDescription('Choose the game to find the map from.')
                                    .setRequired(true)
                                    .addChoices(...choices.game)    
                            ).addStringOption(option =>
                                option.setName('parameters')
                                    .setDescription('Provide a list of parameters defining the map. e.g. "markv totems knucracker fly up#1222".')    
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('intro')
                            .setDescription('[Mod] Build an intro message to Champion of KC or Master of Chronom.')
                            .addStringOption(option =>
                                option.setName('type')
                                    .setDescription('Display intro for Champion of KC or Master of Chronom?')
                                    .setRequired(true)
                                    .addChoices({ name: 'Champion of KC', value: 'champion' },
                                                { name: 'Master of Chronom',  value: 'chronom' })    
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('pinmania')
                            .setDescription('[Mod] Automatically re-pin the pinned messages in Competition.')
                    ).toJSON()
            ]

            logger.info('Started refreshing application (/) commands.');
            const rest = new REST({ version: '9' }).setToken(bot.token);
            for(const guild of Array.from(bot.client.guilds.cache.values())) {
                logger.info(`Refreshing commands for ${guild.name}.`);

                await rest.put(
                    Routes.applicationGuildCommands(clientId, guild.id),
                    { body: commands },
                );

                await Bot.Util.Promise.sleep(3000);
            }
            logger.info('Successfully reloaded application (/) commands.');
        })().catch(logger.error);

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
    m.reply(`Using commands in this way is no longer supported. Please use slash (/) commands e.g. /${str}`).then(message => {
        setTimeout(() => {
            m.delete();
            message.delete();
        }, 15000)
    }).catch(logger.error);
}