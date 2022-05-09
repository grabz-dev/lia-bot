import zlib from 'zlib';

import { promisify } from 'util';
const do_gunzip = promisify(zlib.gunzip);

/**
 * 
 * @param {Uint8Array} buffer 
 */
export async function gunzip(buffer) {
    return await do_gunzip(buffer);
}