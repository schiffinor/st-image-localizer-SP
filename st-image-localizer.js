// plugins/st-image-localizer.js
// CommonJS plugin for SillyTavern


const fs = require('node:fs');
const path = require('node:path');
const cacheBuster = require('../src/middleware/cacheBuster');
// ^^^ Total bust, did not do what I needed, maybe im using it wrong.

/**
 * Initialize plugin.
 * @param {import('express').Router} router Express router
 * @returns {Promise<void>}
 */
async function init(router) {
    // POST /api/plugins/st-image-localizer/move-image
    // Body: { from: "/user/files/char_0.png", to: "/user/images/Char/0.png" }
    router.post('/move-image', async (req, res) => {
        try {
            const { from, to } = req.body || {};

            if (typeof from !== 'string' || typeof to !== 'string') {
                return res.status(400).send('Missing or invalid "from" / "to"');
            }

            // Basic sanity
            if (!from.startsWith('/user/files/')) {
                return res.status(400).send('Source path must start with /user/files/');
            }
            if (!to.startsWith('/user/images/')) {
                return res.status(400).send('Destination path must start with /user/images/');
            }

            const rootDir = req.user?.directories?.root;
            const filesDir = req.user?.directories?.files;

            if (!rootDir || !filesDir) {
                console.error('[st-image-localizer] Missing user directories on request');
                return res.status(500).send('Server misconfiguration');
            }

            // Resolve absolute paths inside the user root
            const srcRel = from.replace(/^\//, ''); // strip leading slash
            const dstRel = to.replace(/^\//, '');

            const absFrom = path.join(rootDir, srcRel);
            const absTo = path.join(rootDir, "../../public/", dstRel);

            // Ensure "from" is inside the user's files directory
            if (!absFrom.startsWith(filesDir)) {
                return res.status(400).send('Invalid source location');
            }

            // Ensure "to" is inside /user/images/...
            const imagesRoot = path.join(rootDir, "../../public/",'user', 'images');
            console.log("Images root:", imagesRoot);
            console.log("Absolute to:", absTo);
            if (!absTo.startsWith(imagesRoot)) {
                return res.status(400).send('Invalid destination location');
            }

            // Make sure target directory exists
            fs.mkdirSync(path.dirname(absTo), { recursive: true });

            // Move (rename) the file
            fs.renameSync(absFrom, absTo);

            console.info(`[st-image-localizer] Moved file: ${from} -> ${to}`);

            // Just echo back the client-visible path we were asked to use.
            return res.send({ moved: true, path: to });
        } catch (err) {
            console.error('[st-image-localizer] move-image error:', err);
            return res.sendStatus(500);
        }
    });

    console.log('[st-image-localizer] Plugin loaded');
    return Promise.resolve();
}

async function exit() {
    // Nothing special to clean up
    return Promise.resolve();
}

module.exports = {
    init,
    exit,
    info: {
        id: 'st-image-localizer',
        name: 'ST Image Localizer Helper',
        description: 'Moves uploaded files from ./user/files to ./../../public/user/images/<charName>/N.ext for the image-localizer extension.',
    },
};
