import { ConnectionState, DisconnectReason, WASocket } from "@whiskeysockets/baileys";
import logger from '../logger';

let reconnectTimer: NodeJS.Timeout | null = null;

function getReconnectDelayMs() {
    const configured = Number(process.env.WA_RECONNECT_DELAY_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : 5000;
}

function handleConnectionUpdate(sock: WASocket, update: Partial<ConnectionState>, connectToWhatsApp: () => Promise<void>) {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        let shouldReconnect = true;
        const error = lastDisconnect?.error as any;
        const statusCode = error?.output?.statusCode;
        if (error && error.output && typeof error.output.statusCode !== 'undefined') {
            shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        }
        logger.warn('#handleConnectionUpdate - Connection closed', { error: lastDisconnect?.error, shouldReconnect });
        if (shouldReconnect) {
            if (reconnectTimer) return;

            const delayMs = statusCode === DisconnectReason.restartRequired ? 0 : getReconnectDelayMs();
            logger.info(`#handleConnectionUpdate - reconnecting in ${delayMs}ms`);
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connectToWhatsApp().catch((err: any) => {
                    logger.error(`#handleConnectionUpdate - reconnect failed - ${err?.message}`);
                });
            }, delayMs);
        }
    } else if (connection === 'open') {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        logger.info('#handleConnectionUpdate - Connection opened successfully');
    }
}

function handleConnectionEvent(sock: WASocket, connectToWhatsApp: () => Promise<void>) {
    sock.ev.on('connection.update', (update) => {
        handleConnectionUpdate(sock, update, connectToWhatsApp);
    });
}

export { handleConnectionEvent };
