/**
 * Small stream helpers used while reading multipart file uploads. Kept
 * separate from attachmentService so the buffering/draining logic can be
 * reasoned about (and tested) independently of upload orchestration.
 */

/**
 * Reads a stream fully into a Buffer, rejecting (and destroying the
 * stream) as soon as maxBytes is exceeded rather than buffering the whole
 * oversized file first.
 *
 * @param {import('stream').Readable} stream
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
function bufferStream(stream, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;

        stream.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                stream.destroy();
                reject(new Error('FILE_TOO_LARGE'));
                return;
            }
            chunks.push(chunk);
        });

        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

/**
 * Consumes and discards a stream without buffering it. Used for file parts
 * that are rejected before upload (unsupported type, over the attachment
 * cap) so the multipart parser isn't left with an unconsumed part, which
 * could otherwise stall parsing of the remaining files in the same request.
 *
 * @param {import('stream').Readable} stream
 * @returns {Promise<void>}
 */
function drainStream(stream) {
    return new Promise((resolve) => {
        stream.on('data', () => {});
        stream.on('end', resolve);
        stream.on('error', resolve);
        stream.resume();
    });
}

module.exports = { bufferStream, drainStream };
