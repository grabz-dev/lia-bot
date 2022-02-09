export const VERSION = 2;

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
 * @returns {string}
 */
export function determineMove(rolls, data, internal) {
    let str = internal.str;
    if(str == null) str = '';
    const diceLeft = rolls.length;
    const pointsToGoal = data.pointsGoal - data.pointsCurrent - data.pointsBanked;

    if(haveEnoughPoints(rolls, pointsToGoal)) {
        internal.forceFinish = true;
    }

    if(check.sixInARow(rolls))          str += '123456';
    if(check.fiveInARowHigher(rolls))   str += '23456';
    if(check.fiveInARowLower(rolls))    str += '12345';
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(6, v, rolls)) str += `${v}${v}${v}${v}${v}${v}`; });
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(5, v, rolls)) str += `${v}${v}${v}${v}${v}`; });
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(4, v, rolls)) str += `${v}${v}${v}${v}`; });
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(3, v, rolls)) str += `${v}${v}${v}`; });

    if(!internal.forceFinish && rolls.length >= 5) {
        if(check.single(1, rolls)) str += '1';
        else if(check.single(5, rolls)) str += '5';
    }
    else {
        if(check.single(1, rolls)) str += '1';
        if(check.single(1, rolls)) str += '1';
        if(check.single(5, rolls)) str += '5';
        if(check.single(5, rolls)) str += '5';
    }

    if(rolls.length - diceLeft > 1) {
        return determineMove(rolls, data, { str });
    }

    if(!internal.noCheckNext) {
        const nextRolls = rolls.slice();
        determineMove(nextRolls, data, { str: '', noCheckNext: true });
        if(internal.forceFinish || (rolls.length <= 3 && nextRolls.length !== 0)) str = `f${str}`;
        else str = `k${str}`;
    }

    return str;
}

/**
 * @param {number[]} rolls
 * @param {number} pointsToGoal
 */
function haveEnoughPoints(rolls, pointsToGoal) {
    for(let match of matches) {
        let overlap = arrayOverlap(rolls, match.m);
        let points = match.p;

        if(overlap && points >= pointsToGoal) return true;
    }

    return false;
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
        if(index <= -1) return false;
        rolls.splice(index, 1);
    }

    return true;
}