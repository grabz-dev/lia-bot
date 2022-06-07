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
        { name: 'Creeper World 1', value: 'cw1' }
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
        /** @type {import('./src/modules/Experience.js').default} */
        const experience = await core.getModule((await import('./src/modules/Experience.js')).default);
        /** @type {import('./src/modules/Chronom.js').default} */
        const chronom = await core.getModule((await import('./src/modules/Chronom.js')).default);
        /** @type {import('./src/modules/Emotes.js').default} */
        const emotes = await core.getModule((await import('./src/modules/Emotes.js')).default);

        setTimeout(() => {
            core.addLoop(1000 * 60 * 48, guild => { experience.loop(guild, kcgmm, champion); });
        }, 9000);
        setTimeout(() => {
            core.addLoop(1000 * 60 * 5, guild => { hurtheal.loop(guild); });
        }, 20000);
        setTimeout(() => {
            core.addLoop(1000 * 60 * 27, guild => { chronom.loop(guild, kcgmm); });
        }, 5000);
        setTimeout(() => {
            core.addLoop(1000 * 60 * 14, guild => { competition.loop(guild, kcgmm, champion); });
        }, 5000);


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
        

        (async () => {
            core.addCommand({baseNames: 'emote', commandNames: null, categoryNames: [':diamond_shape_with_a_dot_inside: Core', 'core'], authorityLevel: 'MODERATOR'}, (message, args, arg) => {
                unsupportedMessage(message.message, 'emote');
            });
        })().catch(logger.error);

        (async () => {
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
        })().catch(logger.error);

        (async () => {
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

            logger.info(`${interaction.member.nickname??interaction.member.user.username}#${interaction.member.user.discriminator} used /${interaction.commandName}`);

            /**
             * @param {Discord.TextChannel|Discord.ThreadChannel} channel
             * @param {Bot.Module} module 
             * @param {any} data 
             */
            const interact = (channel, module, data) => {
                if(!forcePermit && !module.interactionPermitted(interaction, interaction.guild, interaction.member)) {
                    interaction.reply({ content: 'You are not permitted to use this command.', ephemeral: true }).catch(logger.error);
                    return;
                }
                module.incomingInteraction(interaction, interaction.guild, interaction.member, channel, data).catch(logger.error);
                return;
            }

            let forcePermit = false;
            if(Bot.Util.isMemberAdmin(interaction.member) || interaction.member.id === bot.fullAuthorityOverride) {
                forcePermit = true;
            }

            switch(interaction.commandName) {
                case '4rpl':
                case 'prpl':
                case 'crpl': {
                    interact(interaction.channel, wiki, { });
                    break;
                }
                case 'mod_emote': {
                    interact(interaction.channel, emotes, { });
                    break;
                }
                case 'chronom': {
                    interact(interaction.channel, chronom, { kcgmm });
                    break;
                }
                case 'stream':
                case 'mod_stream': {
                    interact(interaction.channel, stream, { });
                    break;
                }
                case 'exp':
                case 'mod_exp': {
                    interact(interaction.channel, experience, { kcgmm, champion });
                    break;
                }
                case 'c':
                case 'mod_c':
                case 'admin_c': {
                    interact(interaction.channel, competition, { kcgmm, champion, map });
                    break;
                }
                case 'map':
                case 'score':
                case 'bestof': {
                    interact(interaction.channel, map, { kcgmm });
                    break;
                }
            }
        });

        (async () => {
            if(bot.client.user == null) return;
            const clientId = bot.client.user.id;

            const commands = [
                new SlashCommandBuilder()
                .setName('4rpl')
                .setDescription('Bring up information about a 4RPL command from the wiki.')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The 4RPL command to bring up.')
                        .setRequired(true)
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('prpl')
                .setDescription('Bring up information about a PRPL command from the wiki.')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The PRPL command to bring up.')
                        .setRequired(true)
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('crpl')
                .setDescription('Bring up information about a CRPL command from the wiki.')
                .addStringOption(option =>
                    option.setName('command')
                        .setDescription('The CRPL command to bring up.')
                        .setRequired(true)
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('mod_emote')
                .setDescription('[Mod] Set a game related emote for use in various game related bot messages and embeds.')
                .setDefaultMemberPermissions('0')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The game to assign the emote for.')
                        .setRequired(true)
                        .addChoices(...choices.game)
                ).addStringOption(option =>
                    option.setName('emote')
                        .setDescription('The emote to use.')
                        .setRequired(true)
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('chronom')
                .setDescription('Display your Creeper World 4 Chronom standings. This can earn you the Master of Chronom role!')
                .toJSON(),
                new SlashCommandBuilder()
                .setName('stream')
                .setDescription('Collection of Stream related commands.')
                .addSubcommand(subcommand => 
                    subcommand.setName('start')
                        .setDescription('Show a stream notification in #community-events that you are currently streaming a KC game.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game you are streaming.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addStringOption(option =>
                            option.setName('url')
                                .setDescription('The link to your stream.')
                                .setRequired(true)
                        )
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('mod_stream')
                .setDescription('[Mod] Collection of Stream related commands.')
                .setDefaultMemberPermissions('0')
                .addSubcommand(subcommand => 
                    subcommand.setName('setchannel')
                        .setDescription('[Mod] Set a channel that will receive stream notifications.')
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('exp')
                .setDescription('Collection of Experience related commands.')
                .addSubcommand(subcommand =>
                    subcommand.setName('register')
                        .setDescription('Register your in-game name for Experience related bot features.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game you wish to register your in-game name for.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addStringOption(option =>
                            option.setName('username')
                                .setDescription('The name you use on the in-game leaderboards. Case sensitive!')
                                .setRequired(true)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('leaderboard')
                        .setDescription('Display the Exp leaderboard for a given game. Leaderboards are also pinned in #bot-commands!')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to display the current Experience leaderboard for.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('profile')
                        .setDescription('Display your current Experience profile and maps left to complete.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to display your profile for.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addBooleanOption(option =>
                            option.setName('dm')
                                .setDescription('Set to True if you want a copy of the message to be sent to you in DM\'s.')
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('new')
                        .setDescription('Claim experience from maps completed in the current round, and generate more maps to beat.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to claim and get new maps from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addBooleanOption(option =>
                            option.setName('dm')
                                .setDescription('Set to True if you want a copy of the message to be sent to you in DM\'s.')
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('info')
                        .setDescription('View information about what Experience is, and how to get started.')
                ).addSubcommand(subcommand =>
                    subcommand.setName('ignore')
                        .setDescription('Ignore map(s). Ignored maps will not show up when generating new maps until unignored.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to claim and get new maps from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addStringOption(option =>
                            option.setName('map')
                                .setDescription('The map ID to ignore. Type `rest` to ignore your remaining uncomplete Experience maps.')
                                .setRequired(true)
                        ).addIntegerOption(option =>
                            option.setName('map2')
                                .setDescription('Additional map ID to ignore')
                        ).addIntegerOption(option =>
                            option.setName('map3')
                                .setDescription('Additional map ID to ignore')
                        ).addIntegerOption(option =>
                            option.setName('map4')
                                .setDescription('Additional map ID to ignore')
                        ).addIntegerOption(option =>
                            option.setName('map5')
                                .setDescription('Additional map ID to ignore')
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('unignore')
                        .setDescription('Ungnore map(s). Unignoring maps will make them show up again when generating new maps.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to claim and get new maps from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addIntegerOption(option =>
                            option.setName('map')
                                .setDescription('The map ID to unignore.')
                                .setRequired(true)
                        ).addIntegerOption(option =>
                            option.setName('map2')
                                .setDescription('Additional map ID to unignore')
                        ).addIntegerOption(option =>
                            option.setName('map3')
                                .setDescription('Additional map ID to unignore')
                        ).addIntegerOption(option =>
                            option.setName('map4')
                                .setDescription('Additional map ID to unignore')
                        ).addIntegerOption(option =>
                            option.setName('map5')
                                .setDescription('Additional map ID to unignore')
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('ignorelist')
                        .setDescription('Display a list of all the maps you\'ve ignored in Experience.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to display the ignored maps from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        )
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('mod_exp')
                .setDescription('[Mod] Collection of Experience related commands.')
                .setDefaultMemberPermissions('0')
                .addSubcommand(subcommand =>
                    subcommand.setName('message')
                        .setDescription('Build or rebuild an automaticaly updating Exp leaderboard message for a given game.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to build the autoupdating message for. This will detach the previous message, if any.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('rename')
                        .setDescription('Change a user\'s registered leaderboard name for a given game.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to change the user\'s name for.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addUserOption(option =>
                            option.setName('user')
                                .setDescription('The user to change the name of.')    
                                .setRequired(true)
                        ).addStringOption(option =>
                            option.setName('name')
                                .setDescription('The chosen user\'s new desired leaderboard name.')    
                                .setRequired(true)
                        )
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('map')
                .setDescription('Display information about a map.')
                .addSubcommand(subcommand =>
                    subcommand.setName('id')
                        .setDescription('Display information about a map, searching by ID.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game the map is from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addIntegerOption(option =>
                            option.setName('id')
                                .setDescription('The map ID number.')
                                .setRequired(true)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('title')
                        .setDescription('Display information about a map, searching by map title.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game the map is from.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addStringOption(option =>
                            option.setName('title')
                                .setDescription('The full or partial map title to search (case insensitive).')
                                .setRequired(true)
                        ).addStringOption(option =>
                            option.setName('author')
                                .setDescription('The name of the map author (case insensitive).')
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('random')
                        .setDescription('Display information about a map, choosing a random one.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game to pick randomly from. Omit to also pick a random game.')
                                .addChoices(...choices.game)
                        )
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('score')
                .setDescription('Display scores of a map.')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The game the map is from.')
                        .setRequired(true)
                        .addChoices(...choices.game)
                ).addStringOption(option =>
                    option.setName('parameters')
                        .setDescription('Examples: "7 totems" "dmd 34" "code small medium abc" "markv nullify abc#1444"')
                        .setRequired(true)
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('bestof')
                .setDescription('Display a list of the highest rated maps from a given month.')
                .addStringOption(option =>
                    option.setName('game')
                        .setDescription('The game the maps should be from.')
                        .setRequired(true)
                        .addChoices(...choices.game)
                ).addStringOption(option =>
                    option.setName('date')
                        .setDescription('The month to pick. Example date format: 2022-06')
                        .setRequired(true)
                ).toJSON(),
                new SlashCommandBuilder()
                .setName('c')
                .setDescription('Collection of Competition related commands.')
                .addSubcommand(subcommand =>
                    subcommand.setName('info')
                        .setDescription('View information about the Competition.')
                ).addSubcommand(subcommand =>
                    subcommand.setName('register')
                        .setDescription('Register your in-game name for Competition related bot features.')
                        .addStringOption(option =>
                            option.setName('game')
                                .setDescription('The game you wish to register your in-game name for.')
                                .setRequired(true)
                                .addChoices(...choices.game)
                        ).addStringOption(option =>
                            option.setName('username')
                                .setDescription('The name you use on the in-game leaderboards. Case sensitive!')
                                .setRequired(true)
                        )
                ).addSubcommand(subcommand =>
                    subcommand.setName('update')
                        .setDescription('Force a manual update of the Competition score standings.')
                ).toJSON(),
                new SlashCommandBuilder()
                    .setName('admin_c')
                    .setDescription('[Admin] Collection of Competition related commands.')
                    .setDefaultMemberPermissions('0')
                    .addSubcommand(subcommand =>
                        subcommand.setName('setchannel')
                            .setDescription('[Admin] Set the competition channel.')
                ).toJSON(),
                new SlashCommandBuilder()
                    .setName('mod_c')
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
                        subcommand.setName('addmap')
                            .setDescription('[Mod] Add a map to the current Competition.')
                            .addStringOption(option =>
                                option.setName('game')
                                    .setDescription('The game to add the map from.')
                                    .setRequired(true)
                                    .addChoices(...choices.game)    
                            ).addStringOption(option =>
                                option.setName('parameters')
                                    .setDescription('Examples: "7 totems" "dmd 34" "code small medium abc" "markv nullify abc#1444"')
                                    .setRequired(true)
                            )
                    ).addSubcommand(subcommand =>
                        subcommand.setName('removemap')
                            .setDescription('[Mod] Remove a map from the current Competition.')
                            .addStringOption(option =>
                                option.setName('game')
                                    .setDescription('The game of the map.')
                                    .setRequired(true)
                                    .addChoices(...choices.game)    
                            ).addStringOption(option =>
                                option.setName('parameters')
                                    .setDescription('Examples: "7 totems" "dmd 34" "code small medium abc" "markv nullify abc#1444"')
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
                                    .setDescription('The game to find the map from.')
                                    .setRequired(true)
                                    .addChoices(...choices.game)    
                            ).addStringOption(option =>
                                option.setName('parameters')
                                    .setDescription('Examples: "7 totems" "dmd 34" "code small medium abc" "markv nullify abc#1444"')
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
    m.reply(`I am now using slash commands! You can use this command with \`/${str}\``).then(message => {
        setTimeout(() => {
            m.delete();
            message.delete();
        }, 15000)
    }).catch(logger.error);
}