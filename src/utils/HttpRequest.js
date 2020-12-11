import https from 'https';
import xml2js from 'xml2js';
import zlib from 'zlib';
import fetch from 'node-fetch';

export function HttpRequest() {}

HttpRequest.fetch = fetch;

/**
 * Send a HTTP GET request
 * @param {string} url - The URL to request.
 * @param {boolean=} isXml - Whether the received data should be in XML format.
 * @returns {Promise<string>} - The received data.
 */
HttpRequest.get = function(url, isXml) {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            let data = '';

            response.on('data', chunk => {
                data += chunk;
            });

            response.on('end', async () => {
                if(isXml)
                    resolve(await xml2js.parseStringPromise(data));
                else
                    resolve(data);
            });

            response.on('error', err => {
                reject(err);
            });
        }).on('error', err => {
            reject(err);
        });
    });
}
/**
 * Send a HTTP GET request to retrieve gzipped data.
 * https://stackoverflow.com/questions/12148948/how-do-i-ungzip-decompress-a-nodejs-requests-module-gzip-response-body/12776856#12776856
 * @param {string} url - The URL to request.
 * @returns {Promise<string>} - The received data.
 */
HttpRequest.getGzipped = function(url) {
    return new Promise((resolve, reject) => {
        //buffer to store the streamed decompression
        /** @type {Buffer[]} */
        var buffer = [];

        https.get(url, res => {
            //pipe the response into the gunzip to decompress
            var gunzip = zlib.createGunzip();            
            res.pipe(gunzip);

            gunzip.on('data', data => {
                //decompression chunk ready, add it to the buffer
                buffer.push(data.toString())
            }).on('end', () => {
                //response and decompression complete, join the buffer and return
                resolve(buffer.join(''));
            }).on('error', err => reject(err));
        }).on('error', err => reject(err));
    });
}