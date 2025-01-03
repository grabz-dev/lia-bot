/**
 * @typedef {object} CampaignMapDefinition
 * @property {string} name
 * @property {string} gameUID
 * @property {number} exp
 * @property {string=} categoryOverride
 */

export const campaign = {
    ixe: [{
        name: 'Story',
        atOnce: 1,
        primary: true,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Cero: Beginnings',              gameUID: 'c3Rvcnkw',               exp: 125 },
            { name: 'Alcance: Purpose',           gameUID: 'c3Rvcnkx',               exp: 150 }, 
            { name: 'Procyon: Unexpected',           gameUID: 'c3Rvcnky',               exp: 175 }, 
            { name: 'Mintaka: Frozen',           gameUID: 'c3Rvcnkz',               exp: 200 }, 
            { name: 'Mirfak: Looking Up',            gameUID: 'c3Rvcnk0',               exp: 225 }, 
            { name: 'Aldebaran: Bizarro',         gameUID: 'c3Rvcnk1',               exp: 250 }, 
            { name: 'Orionis: Ephemeral',           gameUID: 'c3Rvcnk2',               exp: 275 }, 
            { name: 'Solara: Voracious',            gameUID: 'c3Rvcnk3',               exp: 300 }, 
            { name: 'Elysium: Assault',           gameUID: 'c3Rvcnk4',               exp: 325 }, 
            { name: 'Vega: Passage',              gameUID: 'c3Rvcnk5',               exp: 350 }, 
            { name: 'Altair: Gateway',            gameUID: 'c3RvcnkxMA==',            exp: 375 }, 
            { name: 'Arcturus: Enigma',          gameUID: 'c3RvcnkxMQ==',            exp: 400 }, 
            { name: 'Taurus: Blaze',            gameUID: 'c3RvcnkxMg==',            exp: 425 }, 
            { name: 'Spica: Echo',             gameUID: 'c3RvcnkxMw==',            exp: 450 }, 
            { name: 'Deneb: Distant',             gameUID: 'c3RvcnkxNA==',            exp: 475 }, 
            { name: 'Achernar: Pursuit',          gameUID: 'c3RvcnkxNQ==',            exp: 500 }, 
            { name: 'Fomalhaut: Turbulence',         gameUID: 'c3RvcnkxNg==',            exp: 525 }, 
            { name: 'Algol: Rift',             gameUID: 'c3RvcnkxNw==',            exp: 550 }, 
            { name: 'Diphda: Horizon',            gameUID: 'c3RvcnkxOA==',            exp: 575 }, 
            { name: 'Bellatrix: Ascend',         gameUID: 'c3RvcnkxOQ==',            exp: 600 }, 
        ]
        
    },{
        name: 'Tangent',
        atOnce: 0,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Chapter 1',              gameUID: 'dGFuZ2VudDE=',    exp: 100 },
            { name: 'Chapter 2',              gameUID: 'dGFuZ2VudDI=',    exp: 200 },
            { name: 'Chapter 3',              gameUID: 'dGFuZ2VudDM=',    exp: 300 },
            { name: 'Chapter 4',              gameUID: 'dGFuZ2VudDQ=',    exp: 400 },
            { name: 'Chapter 5',              gameUID: 'dGFuZ2VudDU=',    exp: 500 },
            { name: 'Chapter 6',              gameUID: 'dGFuZ2VudDY=',    exp: 600 },
            { name: 'Chapter 7',              gameUID: 'dGFuZ2VudDc=',    exp: 700 },
        ]
    },{
        name: 'Tangent',
        atOnce: 0,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Trial 1',              gameUID: 'ZGVtbzE=',    exp: 100 },
            { name: 'Trial 2',              gameUID: 'ZGVtbzI=',    exp: 200 },
            { name: 'Trial 3',              gameUID: 'ZGVtbzM=',    exp: 300 },
            { name: 'Trial 4',              gameUID: 'ZGVtbzQ=',    exp: 400 },
            { name: 'Trial 5',              gameUID: 'ZGVtbzU=',    exp: 500 },
        ]
    }],
    cw4: [{
        name: 'Farsite Expedition',
        atOnce: 1,
        primary: true,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: '09 Leo, 266',              gameUID: 'c3Rvcnkw',            exp: 125 }, 
            { name: 'Farsite',                  gameUID: 'c3Rvcnkx',            exp: 150 },
            { name: 'Home',                     gameUID: 'c3Rvcnky',            exp: 175 },
            { name: 'Not My Mars',              gameUID: 'c3Rvcnkz',            exp: 200 },
            { name: 'Ruins Repurposed',         gameUID: 'c3Rvcnk0',            exp: 225 },
            { name: 'We Know Nothing',          gameUID: 'c3Rvcnk1',            exp: 250 },
            { name: 'We Were Never Alone',      gameUID: 'c3Rvcnk2',            exp: 275 },
            { name: 'Hints',                    gameUID: 'c3Rvcnk3',            exp: 300 },
            { name: 'Serious',                  gameUID: 'c3Rvcnk4',            exp: 325 },
            { name: 'More and More',            gameUID: 'c3Rvcnk5',            exp: 350 },
            { name: 'War and Peace',            gameUID: 'c3RvcnkxMA%3d%3d',    exp: 375 },
            { name: 'Shattered',                gameUID: 'c3RvcnkxMQ%3d%3d',    exp: 400 },
            { name: 'Archon',                   gameUID: 'c3RvcnkxMg%3d%3d',    exp: 425 },
            { name: 'The Experiment',           gameUID: 'c3RvcnkxMw%3d%3d',    exp: 450 },
            { name: 'Somewhere in Spacetime',   gameUID: 'c3RvcnkxNA%3d%3d',    exp: 475 },
            { name: 'Tower of Darkness',        gameUID: 'c3RvcnkxNQ%3d%3d',    exp: 500 },
            { name: 'The Compound',             gameUID: 'c3RvcnkxNg%3d%3d',    exp: 525 },
            { name: 'Sequence',                 gameUID: 'c3RvcnkxNw%3d%3d',    exp: 550 },
            { name: 'Wallis',                   gameUID: 'c3RvcnkxOA%3d%3d',    exp: 575 },
            { name: 'Founders',                 gameUID: 'c3RvcnkxOQ%3d%3d',    exp: 600 },
            { name: 'Ever After',               gameUID: 'c3RvcnkyMA%3d%3d',    exp: 1000 },
        ]
    }, {
        name: 'Span Experiments',
        atOnce: 1,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Special',                          gameUID: 'a251Y3JhY2tlcjEy',                exp: 250 },
            { name: 'The Dark Side',                    gameUID: 'a251Y3JhY2tlcjE3',                exp: 250 },
            { name: 'Turtle',                           gameUID: 'a251Y3JhY2tlcjU%3d',              exp: 250 },
            { name: 'Cheap Construction',               gameUID: 'a251Y3JhY2tlcjg%3d',              exp: 250 },
            { name: 'Four Pieces',                      gameUID: 'a251Y3JhY2tlcjI%3d',              exp: 250 },
            { name: 'Highway to helheim',               gameUID: 'a251Y3JhY2tlcjEz',                exp: 250 },
            { name: 'Holdem 2',                         gameUID: 'a251Y3JhY2tlcmJvbnVzMQ%3d%3d',    exp: 500 },
            { name: 'Neuron',                           gameUID: 'a251Y3JhY2tlcjM%3d',              exp: 375 },
            { name: 'Valley of the Shadow of Death',    gameUID: 'a251Y3JhY2tlcjY%3d',              exp: 250 },
            { name: 'Sector L',                         gameUID: 'a251Y3JhY2tlcjk%3d',              exp: 250 },
            { name: 'Far York Farm',                    gameUID: 'a251Y3JhY2tlcjE4',                exp: 375 },
            { name: 'Invasion',                         gameUID: 'a251Y3JhY2tlcjIw',                exp: 250 },
            { name: 'Forgotten Fortress',               gameUID: 'a251Y3JhY2tlcjE%3d',              exp: 250 },
            { name: 'Mark V Sample',                    gameUID: 'ZGVtb2JvbnVz',                    exp: 300 },
            { name: 'Gort',                             gameUID: 'a251Y3JhY2tlcjEw',                exp: 250 },
            { name: 'Creeperpeace',                     gameUID: 'a251Y3JhY2tlcjE0',                exp: 250 },
            { name: 'Creeper++',                        gameUID: 'a251Y3JhY2tlcjQ%3d',              exp: 250 },
            { name: 'Before Time',                      gameUID: 'ZGVtb2JvbnVzMg%3d%3d',            exp: 300 },
            { name: 'Islands',                          gameUID: 'a251Y3JhY2tlcjE1',                exp: 250 },
            { name: 'Razor',                            gameUID: 'a251Y3JhY2tlcmJvbnVzMA%3d%3d',    exp: 375 },
            { name: 'Day of Infamy',                    gameUID: 'ZGVtb2JvbnVzMw%3d%3d',            exp: 300 },
            { name: 'Parasite',                         gameUID: 'a251Y3JhY2tlcjc%3d',              exp: 500 },
            { name: 'Creepers Pieces',                  gameUID: 'a251Y3JhY2tlcjEx',                exp: 250 },
            { name: 'Enchanted Forest',                 gameUID: 'a251Y3JhY2tlcjE2',                exp: 250 },
            { name: 'Chanson',                          gameUID: 'a251Y3JhY2tlcjE5',                exp: 250 },
            { name: 'Shaka',                            gameUID: 'ZGVtb2JvbnVzNA%3d%3d',            exp: 300 },

        ]
    }],
    pf: [{
        name: 'Story',
        atOnce: 1,
        primary: true,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Naivety',          gameUID: '1Story',                 exp: 250 },
            { name: 'Indelible',        gameUID: '2Story',                 exp: 275 },
            { name: 'Unwise',           gameUID: '3Story',                 exp: 300 },
            { name: 'Insanity',         gameUID: '4Story',                 exp: 325 },
            { name: 'Evidence',         gameUID: '5Story',                 exp: 350 },
            { name: 'Stretch',          gameUID: '6Story',                 exp: 375 },
            { name: 'Brute',            gameUID: '7Story',                 exp: 400 },
            { name: 'Potential',        gameUID: '8Story',                 exp: 425 },
            { name: 'Emergent',         gameUID: '9Story',                 exp: 450 },
            { name: 'Ties',             gameUID: '10Story',                exp: 475 },
            { name: 'Secrets',          gameUID: '11Story',                exp: 500 },
            { name: 'Doppelgangers',    gameUID: '12Story',                exp: 525 },
            { name: 'Intent',           gameUID: '13Story',                exp: 550 },
            { name: 'The 145th',        gameUID: '14Story',                exp: 575 },
            { name: 'Origin',           gameUID: '15Story',                exp: 600 },
        ]
    }, {
        name: 'Inception',
        atOnce: 1,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'The Melt',                 gameUID: '1Inception',                 exp: 260 },
            { name: 'Fountains of Betelgeuse',  gameUID: '2Inception',                 exp: 270 },
            { name: 'Daisy Chain',              gameUID: '3Inception',                 exp: 280 },
            { name: 'Industrial Complex',       gameUID: '4Inception',                 exp: 290 },
            { name: 'Square Land',              gameUID: '5Inception',                 exp: 300 },
            { name: 'CEO\'s Landing',           gameUID: '6Inception',                 exp: 310 },
            { name: 'Archipelago',              gameUID: '7Inception',                 exp: 320 },
            { name: 'The Nest',                 gameUID: '8Inception',                 exp: 330 },
            { name: 'Warp Never Changes',       gameUID: '9Inception',                 exp: 340 },
        ]
    }],
    cw3: [{
        name: 'Arc Eternal',
        atOnce: 1,
        primary: true,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Inceptus : Tempus',        gameUID: 'Tempus',              exp: 125 },
            { name: 'Inceptus : Carcere',       gameUID: 'Carcere',             exp: 150 },
            { name: 'Abitus : Telos',           gameUID: 'Telos',               exp: 175 },
            { name: 'Abitus : Far York',        gameUID: 'Far+York',            exp: 200 },
            { name: 'Abitus : Starsync',        gameUID: 'Starsync',            exp: 225 },
            { name: 'Navox : Jojo',             gameUID: 'Jojo',                exp: 250 },
            { name: 'Navox : Ormos',            gameUID: 'Ormos',               exp: 275 },
            { name: 'Navox : Seedet',           gameUID: 'Seedet',              exp: 300 },
            { name: 'Navox : Flick',            gameUID: 'Flick',               exp: 325 },
            { name: 'Navox : Tiplex',           gameUID: 'Tiplex',              exp: 350 },
            { name: 'Egos : Lemal',             gameUID: 'Lemal',               exp: 375 },
            { name: 'Egos : Ruine',             gameUID: 'Ruine',               exp: 400 },
            { name: 'Egos : Defi',              gameUID: 'Defi',                exp: 425 },
            { name: 'Egos : Choix',             gameUID: 'Choix',               exp: 450 },
            { name: 'Egos : Chanson',           gameUID: 'Chanson',             exp: 475 },
            { name: 'Frykt : Mistet',           gameUID: 'Mistet',              exp: 500 },
            { name: 'Frykt : Crosslaw',         gameUID: 'Crosslaw',            exp: 525 },
            { name: 'Frykt : Vapen',            gameUID: 'Vapen',               exp: 550 },
            { name: 'Apex : Meso',              gameUID: 'Meso',                exp: 575 },
            { name: 'Cliff : Krig',             gameUID: 'Krig',                exp: 600 },
            { name: 'Andere : Otrav',           gameUID: 'Otrav',               exp: 625 },
            { name: 'Andere : Farbor',          gameUID: 'Farbor',              exp: 650 },
            { name: 'Cricket : Arca',           gameUID: 'Arca',                exp: 675 },
            { name: 'Adventure : Fortress of Ultimate Darkness', gameUID: 'credits', exp: 1000, categoryOverride: 'Credits' },
        ]
    }],
    cw2: [{
        name: 'Story',
        atOnce: 1,
        primary: true,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Day 1: Novus Orsa',        gameUID: 's0',              exp: 125 },
            { name: 'Day 2: Far York',          gameUID: 's1',              exp: 150 },
            { name: 'Day 3: Taurus',            gameUID: 's2',              exp: 175 },
            { name: 'Day 4: UC-1004',           gameUID: 's3',              exp: 200 },
            { name: 'Day 5: The Maxia Choice',  gameUID: 's4',              exp: 225 },
            { name: 'Day 6: Chaos',             gameUID: 's5',              exp: 250 },
            { name: 'Day 7: Lost',              gameUID: 's6',              exp: 275 },
            { name: 'Day 8: Sliver',            gameUID: 's7',              exp: 300 },
            { name: 'Day 9: Intelligence',      gameUID: 's8',              exp: 325 },
            { name: 'Day 10: The Experiment',   gameUID: 's9',              exp: 350 },
            { name: 'Day 11: The Cooker',       gameUID: 's10',             exp: 375 },
            { name: 'Day 12: Answer',           gameUID: 's11',             exp: 400 },
            { name: 'Day 13: Horror',           gameUID: 's12',             exp: 425 },
            { name: 'Day 14: Phoenix',          gameUID: 's13',             exp: 450 },
            { name: 'Day 15: Exterminate!',     gameUID: 's14',             exp: 475 },
            { name: 'Day 16: Purpose',          gameUID: 's15',             exp: 500 },
            { name: 'Day 17: Trickery',         gameUID: 's16',             exp: 525 },
            { name: 'Day 18: The Tide',         gameUID: 's17',             exp: 550 },
            { name: 'Day 19: Colony Prime',     gameUID: 's18',             exp: 575 },
            { name: 'Day 20: All Things',       gameUID: 's19',             exp: 600 },
            { name: 'Credits', gameUID: 'credits', exp: 1000, categoryOverride: 'Credits' },
        ]
    }, {
        name: 'Bonus',
        atOnce: 1,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Positronic',       gameUID: 'b0',              exp: 260 },
            { name: 'The Tree',         gameUID: 'b1',              exp: 270 },
            { name: 'Minion Surprise',  gameUID: 'b2',              exp: 280 },
            { name: 'Shields Up!',      gameUID: 'b3',              exp: 290 },
            { name: 'Stygian Depths',   gameUID: 'b4',              exp: 300 },
            { name: 'Odyssey',          gameUID: 'b5',              exp: 310 },
            { name: 'Barbarian Hordes', gameUID: 'b6',              exp: 320 },
            { name: 'Assault',          gameUID: 'b7',              exp: 330 },
            { name: 'Cubic',            gameUID: 'b8',              exp: 340 },
            { name: 'Abyss',            gameUID: 'b9',              exp: 350 },
        ]
    }],
    cw1: [{
        name: 'Story',
        atOnce: 1,
        primary: true,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Hope',        gameUID: "story_0",              exp: 125 },
            { name: 'Taurus',      gameUID: "story_1",              exp: 150 },
            { name: 'Fitch',       gameUID: "story_2",              exp: 175 },
            { name: 'Orion',       gameUID: "story_3",              exp: 200 },
            { name: 'Cetus',       gameUID: "story_4",              exp: 225 },
            { name: 'Ara',         gameUID: "story_5",              exp: 250 },
            { name: 'Corvus',      gameUID: "story_6",              exp: 275 },
            { name: 'Draco',       gameUID: "story_7",              exp: 300 },
            { name: 'Crux',        gameUID: "story_8",              exp: 325 },
            { name: 'Octan',       gameUID: "story_9",              exp: 350 },
            { name: 'Tucana',      gameUID: "story_10",              exp: 375 },
            { name: 'Vela',        gameUID: "story_11",              exp: 400 },
            { name: 'Pavo',        gameUID: "story_12",              exp: 425 },
            { name: 'Ursa',        gameUID: "story_13",              exp: 450 },
            { name: 'Canis',       gameUID: "story_14",              exp: 475 },
            { name: 'Ix',          gameUID: "story_15",              exp: 500 },
            { name: 'Scluptor',    gameUID: "story_16",              exp: 525 },
            { name: 'Volan',       gameUID: "story_17",              exp: 550 },
            { name: 'Pyxis',       gameUID: "story_18",              exp: 575 },
            { name: 'Loki',        gameUID: "story_19",              exp: 600 },
        ]
    }, {
        name: 'Conquest',
        atOnce: 2,
        /** @type {CampaignMapDefinition[]} */
        maps: [
            { name: 'Grim 1',        gameUID: "conquest_0",              exp: 120 },
            { name: 'Grim 2',        gameUID: "conquest_1",              exp: 140 },
            { name: 'Grim 3',        gameUID: "conquest_2",              exp: 160 },
            { name: 'Grim 4',        gameUID: "conquest_3",              exp: 180 },
            { name: 'Grim 5',        gameUID: "conquest_4",              exp: 200 },
            { name: 'Classic Earth',        gameUID: "special_0",              exp: 210, categoryOverride: 'Special Ops' },
            { name: 'Super Tax-Man',        gameUID: "special_1",              exp: 210, categoryOverride: 'Special Ops' },
            { name: 'Skuld 1',        gameUID: "conquest_5",              exp: 220 },
            { name: 'Skuld 2',        gameUID: "conquest_6",              exp: 240 },
            { name: 'Skuld 3',        gameUID: "conquest_7",              exp: 260 },
            { name: 'Skuld 4',        gameUID: "conquest_8",              exp: 280 },
            { name: 'Skuld 5',        gameUID: "conquest_9",              exp: 300 },
            { name: 'Gump',                 gameUID: "special_2",              exp: 310, categoryOverride: 'Special Ops' },
            { name: 'Mouse Shadow',         gameUID: "special_3",              exp: 310, categoryOverride: 'Special Ops' },
            { name: 'Frigg 1',        gameUID: "conquest_10",              exp: 320 },
            { name: 'Frigg 2',        gameUID: "conquest_11",              exp: 340 },
            { name: 'Frigg 3',        gameUID: "conquest_12",              exp: 360 },
            { name: 'Frigg 4',        gameUID: "conquest_13",              exp: 380 },
            { name: 'Frigg 5',        gameUID: "conquest_14",              exp: 400 },
            { name: 'Chess',                gameUID: "special_4",              exp: 410, categoryOverride: 'Special Ops' },
            { name: 'DTD',                  gameUID: "special_5",              exp: 410, categoryOverride: 'Special Ops' },
            { name: 'Vidar 1',        gameUID: "conquest_15",              exp: 420 },
            { name: 'Vidar 2',        gameUID: "conquest_16",              exp: 440 },
            { name: 'Vidar 3',        gameUID: "conquest_17",              exp: 460 },
            { name: 'Vidar 4',        gameUID: "conquest_18",              exp: 480 },
            { name: 'Vidar 5',        gameUID: "conquest_19",              exp: 500 },
            { name: 'Poison',               gameUID: "special_6",              exp: 510, categoryOverride: 'Special Ops' },
            { name: 'ChopRaider',           gameUID: "special_7",              exp: 510, categoryOverride: 'Special Ops' },
            { name: 'Gudrun 1',        gameUID: "conquest_20",              exp: 520 },
            { name: 'Gudrun 2',        gameUID: "conquest_21",              exp: 540 },
            { name: 'Gudrun 3',        gameUID: "conquest_22",              exp: 560 },
            { name: 'Gudrun 4',        gameUID: "conquest_23",              exp: 580 },
            { name: 'Gudrun 5',        gameUID: "conquest_24",              exp: 600 },
            { name: 'Air',                  gameUID: "special_8",              exp: 610, categoryOverride: 'Special Ops' },
            { name: 'KC',                   gameUID: "special_9",              exp: 610, categoryOverride: 'Special Ops' },
        ]
    }]
}