// utils/validateAadhaar.js
// Drop this into your existing backend — no pip, no Python, no ML needed

const MULTIPLICATION_TABLE = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const PERMUTATION_TABLE = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function verhoeffValidate(number) {
    let c = 0;
    const digits = number.split('').reverse();
    for (let i = 0; i < digits.length; i++) {
        c = MULTIPLICATION_TABLE[c][PERMUTATION_TABLE[i % 8][parseInt(digits[i])]];
    }
    return c === 0;
}

function validateAadhaar(aadhaar) {
    if (!/^\d{12}$/.test(aadhaar))
        return { valid: false, reason: "Must be exactly 12 digits" };

    if (aadhaar[0] === '0' || aadhaar[0] === '1')
        return { valid: false, reason: "Invalid — starts with 0 or 1" };

    if (new Set(aadhaar).size === 1)
        return { valid: false, reason: "Invalid pattern — all digits identical" };

    const digits = aadhaar.split('').map(Number);
    if (digits.every((d, i) => i === 0 || d === digits[i - 1] + 1))
        return { valid: false, reason: "Invalid — sequential pattern" };
    if (digits.every((d, i) => i === 0 || d === digits[i - 1] - 1))
        return { valid: false, reason: "Invalid — reverse sequential" };

    if (!verhoeffValidate(aadhaar))
        return { valid: false, reason: "Checksum failed — likely fake" };

    return { valid: true, reason: "Valid Aadhaar format" };
}

module.exports = { validateAadhaar };
