import { WASocket } from "@whiskeysockets/baileys";
import QRCode from "qrcode-terminal";
import logger from '../logger';

function handleCredsEvent(sock: WASocket, saveCreds: () => Promise<void>) {
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        logger.info('#handleCredsEvent - Connection update', { connection, lastDisconnect });
        if (qr) {
            QRCode.generate(qr, { small: true });
            logger.info('#handleCredsEvent - QR code generated for scanning');
        }
    });
}

export { handleCredsEvent };
