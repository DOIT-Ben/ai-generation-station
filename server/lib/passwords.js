const crypto = require('crypto');

const PASSWORD_HASH_KEY_LENGTH = 64;

function createSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function parseStoredHash(storedHash) {
    const [salt, hash] = String(storedHash || '').split(':');
    if (!salt || !hash) {
        return null;
    }

    return { salt, hash };
}

function derivePasswordHash(password, salt) {
    return crypto.scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH).toString('hex');
}

function derivePasswordHashAsync(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, PASSWORD_HASH_KEY_LENGTH, (error, derivedKey) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(derivedKey.toString('hex'));
        });
    });
}

function hashPassword(password, salt = createSalt()) {
    const hash = derivePasswordHash(password, salt);
    return `${salt}:${hash}`;
}

async function hashPasswordAsync(password, salt = createSalt()) {
    const hash = await derivePasswordHashAsync(password, salt);
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    const parsed = parseStoredHash(storedHash);
    if (!parsed) return false;
    const actual = derivePasswordHash(password, parsed.salt);
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(parsed.hash, 'hex'));
}

async function verifyPasswordAsync(password, storedHash) {
    const parsed = parseStoredHash(storedHash);
    if (!parsed) return false;
    const actual = await derivePasswordHashAsync(password, parsed.salt);
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(parsed.hash, 'hex'));
}

module.exports = {
    hashPassword,
    hashPasswordAsync,
    verifyPassword,
    verifyPasswordAsync
};
