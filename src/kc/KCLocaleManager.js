"use strict";

const config = {
    /** @type {Object.<string, string>} */
    "url": {
        "cw1": "creeperworld",
        "cw2": "creeperworld2",
        "cw3": "creeperworld3",
        "pf": "particlefleet",
        "cw4": "creeperworld4"
    },
    
    /** @type {Object.<string, Object.<string, { display: string, aliases?: string[] }>>} */
    "namedef": {
        "game" : {
            "chopraider" : {
                "display": "WhiteboardWar: ChopRaider",
                "aliases": ["whiteboardwarchopraider", "whiteboardwar", "chopraider"]
            },
            "cw1" : {
                "display": "Creeper World",
                "aliases": ["creeperworld1", "creeperworld", "cw", "1", "cw1"]
            },
            "cw2" : {
                "display": "Creeper World 2: Redemption",
                "aliases": ["creeperworld2redemption", "creeperworld2", "cw2", "2", "redemption"]
            },
            "cw3" : {
                "display": "Creeper World 3: Arc Eternal",
                "aliases": ["creeperworld3arceternal", "creeperworld3arc", "creeperworld3", "cw3", "3", "arc", "eternal", "arceternal"]
            },
            "pf" : {
                "display": "Particle Fleet: Emergence",
                "aliases": ["pf", "pf1", "particle", "emergence", "particlefleet", "particlefleetemergence"]
            },
            "cw4" : {
                "display": "Creeper World 4",
                "aliases": ["creeperworld4", "cw4", "4"]
            },
            "gemcraft" : {
                "display": "GemCraft",
                "aliases": ["gemcraft", "gemcraftchasingshadows"]
            }
        },
        "cw2_code_map_size" : {
            "0" : {
                "display": "Small",
                "aliases": ["0", "small", "s", "sm", "sma", "smal"]
            },
            "1" : {
                "display": "Medium",
                "aliases": ["1", "medium", "m", "me", "med", "medi", "mediu"]
            },
            "2" : {
                "display": "Large",
                "aliases": ["2", "large", "l", "la", "lar", "larg"]
            }
        },
        "cw2_code_map_complexity" : {
            "0" : {
                "display": "Low",
                "aliases": ["0", "low", "l", "lo"]
            },
            "1" : {
                "display": "Medium",
                "aliases": ["1", "medium", "m", "me", "med", "medi", "mediu"]
            },
            "2" : {
                "display": "High",
                "aliases": ["2", "high", "h", "hi", "hig"]
            }
        },
        "cw4_objectives" : {
            "0": { "display": "Nullify", "aliases": ["nullify", "n", "0"] },
            "1": { "display": "Totems", "aliases": ["totems", "totem", "t", "1"] },
            "2": { "display": "Reclaim", "aliases": ["reclaim", "r", "2"] },
            "3": { "display": "Hold", "aliases": ["hold", "survive", "h", "3"] },
            "4": { "display": "Collect", "aliases": ["collect", "4"] },
            "5": { "display": "Custom", "aliases": ["custom", "5"] }
        },
        "map_mode_custom" : {
            "cw1_custom" : { "display": "Custom" },
            "cw2_custom" : { "display": "Custom" },
            "cw1_misc": { "display": "" },
            "cw2_code": { "display": "Code" },
            "cw2_misc": { "display": "" },
            "cw3_custom" : { "display": "Colonial Space" },
            "cw3_dmd" : { "display": "DMD" },
            "cw3_misc": { "display": "" },
            "pf_custom" : { "display": "Exchange" },
            "pf_misc": { "display": "" },
            "cw4_custom" : { "display": "Farsite Colonies" },
            "cw4_chronom" : { "display": "Chronom" },
            "cw4_markv" : { "display": "Mark V" },
            "cw4_misc": { "display": "" },
        }
    },
}

export function KCLocaleManager() {}


/**
 * Get the display name from an alias.
 * @param {"game"|"cw2_code_map_size"|"cw2_code_map_complexity"|"cw4_objectives"|"map_mode_custom"} category - The namedef category.
 * @param {string} str - An alias name.
 * @returns {string} The display name.
 */
KCLocaleManager.getDisplayNameFromAlias = function(category, str) {
    if(config.namedef[category] == null) 
        return `[error1,${category},${str}]`;

    let defs = config.namedef[category];    

    str = str.toLowerCase();
    str = str.replace(/[^a-z0-9_]+/gi, "");

    if(defs[str])
        return defs[str].display;

    let def = KCLocaleManager.getPrimaryAliasFromAlias(category, str);
    if(def == null)
        return `[error2,${category},${str}]`;
    return defs[def].display;
}

/**
 * Get the primary alias from any alias.
 * @param {"game"|"cw2_code_map_size"|"cw2_code_map_complexity"|"cw4_objectives"|"map_mode_custom"} category - The namedef category.
 * @param {string} str - An alias to convert to the primary alias.
 * @returns {string | null} The primary alias.
 */
KCLocaleManager.getPrimaryAliasFromAlias = function(category, str) {
    if(config.namedef[category] == null) return null;
    
    let defs = config.namedef[category];
    
    str = str.toLowerCase();
    str = str.replace(/[^a-z0-9_]+/gi, "");

    for(let def in defs) {
        let obj = defs[def];
        if(obj.aliases == null) continue;
        for(let i = 0; i < obj.aliases.length; i++)
            if(str === obj.aliases[i])
                return def;
    }
    
    return null;
}

/**
 * From the url module, get the computed url name from a namedef computed name. For example, cw3 is turned to creeperworld3.
 * @param {string} game - The namedef computed name.
 * @returns {string | null} The url name.
 */
KCLocaleManager.getUrlStringFromPrimaryAlias = function(game) {
    if(config.url[game])
        return config.url[game];

    let def = KCLocaleManager.getPrimaryAliasFromAlias("game", game);
    if(def == null)
        return null;
    
    if(config.url[def])
        return config.url[def];
    return null;
}