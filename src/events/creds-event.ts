import { WASocket } from "baileys";
import QRCode from "qrcode-terminal";

function handleCredsEvent(sock: WASocket, saveCreds: () => Promise<void>) {
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        console.log('#handleCredsEvent - connection update', connection, lastDisconnect);
        if (qr) {
            console.log(QRCode.generate(qr, { small: true }));
        }
    });
}

export { handleCredsEvent };