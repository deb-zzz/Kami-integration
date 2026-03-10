// generateVapidKeys.js
export const dynamic = 'force-dynamic';

/**
 * This module generates VAPID (Voluntary Application Server Identification) keys
 * for use in web push notifications. It uses the 'web-push' library to create
 * a pair of public and private keys, which are then stored in a '.keys.env' file.
 *
 * The VAPID keys are essential for authenticating push notifications sent from
 * a server to a client. The public key is shared with the client, while the
 * private key is kept secure on the server.
 *
 * Dependencies:
 * - web-push: A library for sending web push notifications.
 * - fs: Node.js file system module for writing files.
 *
 * Outputs:
 * - A file named '.keys.env' containing the generated VAPID public and private keys.
 */

import webPush from 'web-push';
import fs from 'fs';

/**
 * Generates VAPID keys using the 'web-push' library.
 *
 * @returns {Object} An object containing the generated VAPID public and private keys.
 * - publicKey {string}: The public key to be shared with clients.
 * - privateKey {string}: The private key to be kept secure on the server.
 */
const vapidKeys = webPush.generateVAPIDKeys();

/**
 * Constructs the environment data string to be written to the '.keys.env' file.
 *
 * @type {string}
 */
const envData = `
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
`;

/**
 * Writes the VAPID keys to a '.keys.env' file.
 *
 * @param {string} filePath - The path to the file where the keys will be written.
 * @param {string} data - The data to be written to the file.
 * @param {Object} options - Options for writing the file.
 * - flag {string}: The flag indicating the file system operation. 'w' for writing.
 */
fs.writeFileSync('.keys.env', envData, { flag: 'w' });
