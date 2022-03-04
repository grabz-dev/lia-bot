export const VERSION = 7;
//Version 4 adds permanent last roll chance mechanic. (2022-03-01)
const DEBUG = false;

/**
 * @typedef {object} FarkleAIData
 * @property {number} pointsBanked
 * @property {number} pointsCurrent
 * @property {number} pointsGoal
 * @property {number} secondToBestPointsBanked
 * @property {{ pointsToBeat: number }=} lastTurn
 */

/**
 * @typedef {object} FarkleAIInternal
 * @property {boolean=} forceFinish
 * @property {string=} str
 * @property {boolean=} noCheckNext
 * @property {boolean=} ignoreThreeTwos
 * @property {boolean=} forceKeep
 */

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

const AIs = {
    /**
     * @param {number[]} rolls 
     * @param {FarkleAIData} data
     * @param {FarkleAIInternal&{str: string}} internal
     * @param {boolean} _debug
     * @returns {string}
     */
    normal(rolls, data, internal, _debug) {
        const THRESHOLD = 500;
        const diceLeft = rolls.length;
        const nextMinimumDiceLeft = nextMinimumDiceLeftThisRoll(rolls);
        const bestPoints = bestPointsThisRoll(rolls);
        const pointsToGoal = data.pointsGoal - data.pointsCurrent - data.pointsBanked;

        const pointDifferentialToNearestOpponent = data.pointsBanked - data.secondToBestPointsBanked;
        const currentPotentialLeadOverNearestOpponent = pointDifferentialToNearestOpponent + data.pointsCurrent + bestPoints;
        const pointsToGoalAfterFinish = data.pointsGoal - data.pointsBanked - data.pointsCurrent - bestPoints;
        const closeEnoughToSweatyPalms = currentPotentialLeadOverNearestOpponent < THRESHOLD && pointsToGoalAfterFinish < THRESHOLD;
        const canWin = bestPoints >= pointsToGoal;

        if(_debug) console.info(JSON.stringify({diceLeft, nextMinimumDiceLeft, bestPoints, pointsToGoal, pointDifferentialToNearestOpponent, currentPotentialLeadOverNearestOpponent, pointsToGoalAfterFinish, closeEnoughToSweatyPalms, canWin}));
        if(_debug) console.info(JSON.stringify(data));

        //If we can win and our point differential is greater than 400, take it.
        //If we're on 6 dice, make sure we can get at least 300 points, otherwise skip this until next time
        if(nextMinimumDiceLeft > 0 && canWin && currentPotentialLeadOverNearestOpponent >= THRESHOLD && ((rolls.length >= 6 && bestPoints >= 300) || rolls.length < 6)) {
            internal.forceFinish = true;
            if(_debug) console.info(`forceFinish = true, can win and point differential to nearest opponent >= ${THRESHOLD}`);
        }
        //If we are in the close to goal threshold and we can finish with 100 or 50 points to goal, we should do so
        else if(closeEnoughToSweatyPalms && data.pointsGoal - data.pointsBanked - data.pointsCurrent > 100) {
            if(_debug) console.info(`GRANULAR val:${data.pointsGoal - data.pointsBanked - data.pointsCurrent - 50}`);
            return granularChoiceNearGoal(rolls, data.pointsGoal - data.pointsBanked - data.pointsCurrent - 50);
        }
        //If we can win but our lead is not enough, try to go for more.
        else if(canWin && currentPotentialLeadOverNearestOpponent < THRESHOLD) {
            internal.forceKeep = true;
            if(_debug) console.info(`forceKeep = true, can win but point differential to nearest opponent < ${THRESHOLD}`);
        }
        //Finish on any dice if >=2000 points and we can't keep everything
        else if(bestPoints + data.pointsCurrent >= 2000 && nextMinimumDiceLeft > 0) {
            internal.forceFinish = true;
            if(_debug) console.info(`forceFinish = true, >=2000 - too risky`);
        }
        //Finish on 5 dice if >=350 points and we can't keep everything
        else if(rolls.length === 5 && bestPoints + data.pointsCurrent >= 350 && nextMinimumDiceLeft > 0) {
            internal.forceFinish = true;
            if(_debug) console.info(`forceFinish = true, >=500 on 5 roll`);
        }
        //Do not finish with 200 points or less
        else if(bestPoints + data.pointsCurrent <= 250) {
            internal.forceKeep = true;
            if(_debug) console.info(`forceKeep = true, <=250 points`);
        }

        //Ignore 222 on first turn if there isn't another three of a kind
        if(rolls.length === 6 && arrayOverlap(rolls, [2, 2, 2]) && nextMinimumDiceLeft > 0 && nextMinimumDiceLeft < 3) {
            internal.ignoreThreeTwos = true;
            if(_debug) console.info(`ignoreThreeTwos = true`);
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

        //If rolls were found and assigned to internal.str
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
    },
    /**
     * @param {number[]} rolls 
     * @param {FarkleAIData&{lastTurn: { pointsToBeat: number }}} data
     * @param {FarkleAIInternal&{str: string}} internal
     * @param {boolean} _debug
     * @returns {string}
     */
    lastTurn(rolls, data, internal, _debug) {
        const diceLeft = rolls.length;
        const pointsToGoal = data.lastTurn.pointsToBeat - data.pointsCurrent - data.pointsBanked;
        const bestPoints = bestPointsThisRoll(rolls);
        const nextMinimumDiceLeft = nextMinimumDiceLeftThisRoll(rolls);

        //Finish if we have enough points to win on this roll.
        if(bestPoints > pointsToGoal) {
            internal.forceFinish = true;
            if(_debug) console.info(`forceFinish = true, last turn, close enough to end`);
        }

        //Ignore 222 on first turn if there isn't another three of a kind
        if(rolls.length === 6 && arrayOverlap(rolls, [2, 2, 2]) && nextMinimumDiceLeft > 0 && nextMinimumDiceLeft < 3) {
            internal.ignoreThreeTwos = true;
            if(_debug) console.info(`ignoreThreeTwos = true`);
        }

        //If we have >=5 dice, aim for good points on next roll, otherwise grab all
        if(rolls.length >= 5 && bestPoints < 500 && nextMinimumDiceLeft > 0 && !internal.forceFinish) {
            if(check.single(1, rolls)) internal.str += '1';
            else if(check.single(5, rolls)) internal.str += '5';
        }

        //If no 1's and 5's could be kept, look for other combos
        if(rolls.length - diceLeft === 0) {
            if(check.sixInARow(rolls))          internal.str += '123456';
            if(check.fiveInARowHigher(rolls))   internal.str += '23456';
            if(check.fiveInARowLower(rolls))    internal.str += '12345';
            [1, 2, 3, 4, 5, 6].forEach(v => { if(check.ofAKind(6, v, rolls)) internal.str += `${v}${v}${v}${v}${v}${v}`; });
            [1, 2, 3, 4, 5, 6].forEach(v => { if(check.ofAKind(5, v, rolls)) internal.str += `${v}${v}${v}${v}${v}`; });
            [1, 2, 3, 4, 5, 6].forEach(v => { if(check.ofAKind(4, v, rolls)) internal.str += `${v}${v}${v}${v}`; });
            (internal.ignoreThreeTwos ? [1, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]).forEach(v => { if(check.ofAKind(3, v, rolls)) internal.str += `${v}${v}${v}`; });
            if(check.single(1, rolls)) internal.str += '1';
            if(check.single(1, rolls)) internal.str += '1';
            if(check.single(5, rolls)) internal.str += '5';
            if(check.single(5, rolls)) internal.str += '5';
        }

        //If rolls were found and assigned to internal.str
        if(rolls.length - diceLeft > 1) {
            return determineMove(rolls, data, internal);
        }

        if(internal.forceFinish) return `f${internal.str}`;
        return `k${internal.str}`;
    }
}

/**
 * 
 * @param {number[]} rolls 
 * @param {FarkleAIData} data
 * @param {FarkleAIInternal} internal
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

    if(data.lastTurn) return AIs.lastTurn(rolls, Object.assign({lastTurn: data.lastTurn}, data), Object.assign({str: internal.str}, internal), _debug);
    return AIs.normal(rolls, data, Object.assign({str: internal.str}, internal), _debug);
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

/** 
 * @param {number[]} rolls 
 * @param {number} toGoal
 * @returns {string}
 */
function granularChoiceNearGoal(rolls, toGoal) {
    let somethingFound;
    
    let rollsDescending = rolls.slice();
    let strDescending = '';
    let matchesSortedDescending = matches.slice();
    matchesSortedDescending.sort((a, b) => b.p - a.p);
    let toGoalResultDescending = toGoal;
    somethingFound = true;
    while(somethingFound) {
        somethingFound = false;

        for(const match of matchesSortedDescending) {
            //If match is found and within our ideal points threshold
            if(match.p <= toGoalResultDescending && arrayOverlap(rollsDescending, match.m)) {
                for(let die of match.m) rollsDescending.splice(rollsDescending.indexOf(die), 1);
                toGoalResultDescending -= match.p;
                somethingFound = true;
                strDescending += match.m.join('');
                break;
            }
        }
    }

    let rollsAscending = rolls.slice();
    let strAscending = '';
    let matchesSortedAscending = matches.slice();
    matchesSortedAscending.sort((a, b) => b.p - a.p);
    let toGoalResultAscending = toGoal;
    somethingFound = true;
    while(somethingFound) {
        somethingFound = false;

        for(const match of matchesSortedAscending) {
            //If match is found and within our ideal points threshold
            if(match.p <= toGoalResultAscending && arrayOverlap(rollsAscending, match.m)) {
                for(let die of match.m) rollsAscending.splice(rollsAscending.indexOf(die), 1);
                toGoalResultAscending -= match.p;
                somethingFound = true;
                strAscending += match.m.join('');
                break;
            }
        }
    }

    const pointsOffGoal = Math.min(toGoalResultDescending, toGoalResultAscending);
    const pointsToScore = toGoal - pointsOffGoal;
    //If we have 5 or 6 rolls, and there were 250 or less points on the board, try to go for single 1 or 5.
    if(rolls.length >= 5 && pointsToScore < 300 && pointsOffGoal > 100) {
        if(pointsOffGoal > 100) {
            if(arrayOverlap(rolls, [1])) return `k1`;
            if(arrayOverlap(rolls, [5])) return `k5`;
        }
        else if(pointsOffGoal > 50) {
            if(arrayOverlap(rolls, [5])) return `k5`;
        }
    }

    let isDescendingBetter = toGoalResultDescending < toGoalResultAscending;
    if(isDescendingBetter) return `f${strDescending}`;
    else return `f${strAscending}`;
}