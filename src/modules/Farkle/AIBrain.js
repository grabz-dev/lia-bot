export const VERSION = 3;
const DEBUG = false;

export const matches = Object.freeze([
    { m: [1, 2, 3, 4, 5, 6],    p: 1500 },
    { m: [2, 3, 4, 5, 6],       p: 750  },
    { m: [1, 2, 3, 4, 5],       p: 500  },
    { m: [1, 1, 1, 1, 1, 1],    p: 8000 },
    { m: [1, 1, 1, 1, 1],       p: 4000 },
    { m: [1, 1, 1, 1],          p: 2000 },
    { m: [1, 1, 1],             p: 1000 },
    { m: [5, 5, 5, 5, 5, 5],    p: 4000 },
    { m: [5, 5, 5, 5, 5],       p: 2000 },
    { m: [5, 5, 5, 5],          p: 1000 },
    { m: [5, 5, 5],             p: 500 },
    { m: [6, 6, 6, 6, 6, 6],    p: 4800 },
    { m: [6, 6, 6, 6, 6],       p: 2400 },
    { m: [6, 6, 6, 6],          p: 1200 },
    { m: [6, 6, 6],             p: 600 },
    { m: [4, 4, 4, 4, 4, 4],    p: 3200 },
    { m: [4, 4, 4, 4, 4],       p: 1600 },
    { m: [4, 4, 4, 4],          p: 800  },
    { m: [4, 4, 4],             p: 400  },
    { m: [3, 3, 3, 3, 3, 3],    p: 2400 },
    { m: [3, 3, 3, 3, 3],       p: 1200 },
    { m: [3, 3, 3, 3],          p: 600  },
    { m: [3, 3, 3],             p: 300  },
    { m: [2, 2, 2, 2, 2, 2],    p: 1600 },
    { m: [2, 2, 2, 2, 2],       p: 800 },
    { m: [2, 2, 2, 2],          p: 400 },
    { m: [2, 2, 2],             p: 200 },
    { m: [1],                   p: 100 },
    { m: [5],                   p: 50  },
]);

const matchesTotal = /** @type {{m: number[], p: number}[]} */([]).concat(matches).concat([
    { m: [1],                   p: 100 },
    { m: [5],                   p: 50  },
])

const check = {
    /** @param {number[]} rolls */
    sixInARow: function(rolls) {
        /** @type {Map<number, boolean>} */
        const dice = new Map();
        /** @type {number[]} */
        const remaining = [];

        for(let roll of rolls) {
            if(dice.get(roll) && roll >= 1 && roll <= 6) remaining.push(roll);
            else dice.set(roll, true);
        }
        if(dice.get(1) && dice.get(2) && dice.get(3) && dice.get(4) && dice.get(5) && dice.get(6)) {
            for(let i = 0; i < rolls.length; i++) {
                const roll = rolls[i];
                if(dice.get(roll)) {
                    rolls.splice(i, 1);
                    i--;
                    dice.set(roll, false);
                }
            }
            return true;
        }
        return false;
    },
    /** @param {number[]} rolls */
    fiveInARowLower: function(rolls) {
        /** @type {Map<number, boolean>} */
        const dice = new Map();
        /** @type {number[]} */
        const remaining = [];

        for(let roll of rolls) {
            if(dice.get(roll) && roll >= 1 && roll <= 5) remaining.push(roll);
            else dice.set(roll, true);
        }
        if(dice.get(1) && dice.get(2) && dice.get(3) && dice.get(4) && dice.get(5)) {
            for(let i = 0; i < rolls.length; i++) {
                const roll = rolls[i];
                if(dice.get(roll)) {
                    rolls.splice(i, 1);
                    i--;
                    dice.set(roll, false);
                }
            }
            return true;
        }
        return false;
    },
    /** @param {number[]} rolls */
    fiveInARowHigher: function(rolls) {
        /** @type {Map<number, boolean>} */
        const dice = new Map();
        /** @type {number[]} */
        const remaining = [];

        for(let roll of rolls) {
            if(dice.get(roll) && roll >= 2 && roll <= 6) remaining.push(roll);
            else dice.set(roll, true);
        }
        if(dice.get(2) && dice.get(3) && dice.get(4) && dice.get(5) && dice.get(6)) {
            for(let i = 0; i < rolls.length; i++) {
                const roll = rolls[i];
                if(dice.get(roll)) {
                    rolls.splice(i, 1);
                    i--;
                    dice.set(roll, false);
                }
            }
            return true;
        }
        return false;
    },
    /**
     * @param {number} amount
     * @param {number} die 
     * @param {number[]} rolls 
     */
    ofAKind(amount, die, rolls) {
        let count = 0;
        for(let roll of rolls) if(roll === die) count++;
        if(count === amount) {
            for(let i = 0; i < rolls.length; i++) {
                const roll = rolls[i];
                if(roll === die && count > 0) {
                    rolls.splice(i, 1);
                    i--;
                    count--;
                }
            }
            return true;
        }
        return false;
    },
    /**
     * @param {number} die 
     * @param {number[]} rolls 
     */
    single(die, rolls) {
        for(let i = 0; i < rolls.length; i++) {
            const roll = rolls[i];
            if(roll === die) {
                rolls.splice(i, 1);
                return true;
            }
        }
        return false;
    }
}

/**
 * 
 * @param {number[]} rolls 
 * @param {object} data
 * @param {number} data.pointsBanked
 * @param {number} data.pointsCurrent
 * @param {number} data.pointsGoal
 * @param {object} internal
 * @param {boolean=} internal.forceFinish 
 * @param {string=} internal.str
 * @param {boolean=} internal.noCheckNext
 * @param {boolean=} internal.ignoreThreeTwos
 * @param {boolean=} internal.forceKeep
 * @returns {string}
 */
export function determineMove(rolls, data, internal) {
    const _debug = DEBUG && !internal.noCheckNext;

    if(_debug && internal.str == null) console.info(`---- NEW DICE ----`);
    if(internal.str == null) internal.str = '';
    delete internal.forceFinish;
    delete internal.forceKeep;
    delete internal.ignoreThreeTwos;

    if(_debug) console.info(`---- ${rolls} ----`);

    const diceLeft = rolls.length;
    const pointsToGoal = data.pointsGoal - data.pointsCurrent - data.pointsBanked;
    const nextMinimumDiceLeft = nextMinimumDiceLeftThisRoll(rolls);
    const bestPoints = bestPointsThisRoll(rolls);

    if(_debug) console.info(`diceLeft: ${diceLeft}, pointsToGoal: ${pointsToGoal}, nextMinimumDiceLeft: ${nextMinimumDiceLeft}, bestPoints: ${bestPoints}`);

    //Finish if we have enough points to win on this roll.
    if(bestPoints >= pointsToGoal) {
        internal.forceFinish = true;
        if(_debug) console.info(`forceFinish = true, close enough to end`);
    }
    //Finish on 5 dice if >=350 points and we can't keep everything
    else if(rolls.length === 5 && bestPoints + data.pointsCurrent >= 350 && nextMinimumDiceLeft > 0) {
        internal.forceFinish = true;
        if(_debug) console.info(`forceFinish = true, >=350 on 5 roll`);
    }
    else if(rolls.length < 6 && bestPoints + data.pointsCurrent >= 1000 && nextMinimumDiceLeft > 0) {
        internal.forceFinish = true;
        if(_debug) console.info(`forceFinish = true, >=1000 on <5 dice - too risky`);
    }
    //Ignore 222 on first turn if there isn't another three of a kind
    else if(rolls.length === 6 && arrayOverlap(rolls, [2, 2, 2]) && nextMinimumDiceLeft > 0 && nextMinimumDiceLeft < 3) {
        internal.ignoreThreeTwos = true;
        if(_debug) console.info(`ignoreThreeTwos = true`);
    }
    //Do not finish with 200 points or less
    else if(bestPoints + data.pointsCurrent <= 250) {
        internal.forceKeep = true;
        if(_debug) console.info(`forceKeep = true, <=250 points`);
    }

    if(check.sixInARow(rolls))          internal.str += '123456';
    if(check.fiveInARowHigher(rolls))   internal.str += '23456';
    if(check.fiveInARowLower(rolls))    internal.str += '12345';
    [1, 2, 3, 4, 5, 6].forEach(v => { if(check.ofAKind(6, v, rolls)) internal.str += `${v}${v}${v}${v}${v}${v}`; });
    [1, 2, 3, 4, 5, 6].forEach(v => { if(check.ofAKind(5, v, rolls)) internal.str += `${v}${v}${v}${v}${v}`; });
    [1, 2, 3, 4, 5, 6].forEach(v => { if(check.ofAKind(4, v, rolls)) internal.str += `${v}${v}${v}${v}`; });
    (internal.ignoreThreeTwos ? [1, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]).forEach(v => { if(check.ofAKind(3, v, rolls)) internal.str += `${v}${v}${v}`; });

    if((!internal.forceFinish && rolls.length >= 5) || internal.forceKeep) {
        if(_debug) console.info(`...keeping one dice...`);
        if(check.single(1, rolls)) internal.str += '1';
        else if(check.single(5, rolls)) internal.str += '5';
    }
    else {
        if(_debug) console.info(`...keeping everything...`);
        if(check.single(1, rolls)) internal.str += '1';
        if(check.single(1, rolls)) internal.str += '1';
        if(check.single(5, rolls)) internal.str += '5';
        if(check.single(5, rolls)) internal.str += '5';
    }

    if(rolls.length - diceLeft > 1) {
        return determineMove(rolls, data, internal);
    }

    if(!internal.noCheckNext) {
        const nextRolls = rolls.slice();
        determineMove(nextRolls, data, { str: '', noCheckNext: true });

        if(internal.forceFinish) return `f${internal.str}`;
        if(internal.forceKeep) return `k${internal.str}`;
        if(rolls.length <= 3 && nextRolls.length !== 0) return `f${internal.str}`;
        return `k${internal.str}`;
    }

    return internal.str;
}

/**
 * @param {number[]} rolls
 */
function bestPointsThisRoll(rolls) {
    let sRolls = rolls.slice();
    let points = 0;

    for(let match of matchesTotal) {
        let overlap = arrayOverlap(sRolls, match.m);
        if(overlap) {
            sRolls = overlap;
            points += match.p;
        }
    }

    return points;
}

/**
 * @param {number[]} rolls
 */
 function nextMinimumDiceLeftThisRoll(rolls) {
    let sRolls = rolls.slice();

    for(let match of matchesTotal) {
        let overlap = arrayOverlap(sRolls, match.m);
        if(overlap) sRolls = overlap;
    }

    return sRolls.length;
}

/**
 * 
 * @param {number[]} rolls 
 * @param {number[]} combo
 */
function arrayOverlap(rolls, combo) {
    rolls = rolls.slice();

    for(let comboVal of combo) {
        let index = rolls.indexOf(comboVal);
        if(index <= -1) return null;
        rolls.splice(index, 1);
    }

    return rolls;
}