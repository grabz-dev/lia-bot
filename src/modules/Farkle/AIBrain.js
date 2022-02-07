export const VERSION = 1;

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
 * @param {string=} str
 * @param {boolean=} noCheckNext
 * @returns {string}
 */
export function determineMove(rolls, str, noCheckNext) {
    if(str == null) str = '';
    const diceLeft = rolls.length;

    if(check.sixInARow(rolls))          str += '123456';
    if(check.fiveInARowHigher(rolls))   str += '23456';
    if(check.fiveInARowLower(rolls))    str += '12345';
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(6, v, rolls)) str += `${v}${v}${v}${v}${v}${v}`; });
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(5, v, rolls)) str += `${v}${v}${v}${v}${v}`; });
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(4, v, rolls)) str += `${v}${v}${v}${v}`; });
    [1, 6, 5, 4, 3, 2].forEach(v => { if(check.ofAKind(3, v, rolls)) str += `${v}${v}${v}`; });

    if(rolls.length >= 5) {
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
        return determineMove(rolls, str);
    }

    if(!noCheckNext) {
        const nextRolls = rolls.slice();
        determineMove(nextRolls, '', true);
        if(rolls.length <= 3 && nextRolls.length !== 0) str = `f${str}`;
        else str = `k${str}`;
    }

    return str;
}
