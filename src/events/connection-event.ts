import { ConnectionState, DisconnectReason, WASocket } from "baileys";


function handleConnectionUpdate(sock: WASocket, update: Partial<ConnectionState>, connectToWhatsApp: () => Promise<void>) {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        let shouldReconnect = true;
        const error = lastDisconnect?.error as any;
        if (error && error.output && typeof error.output.statusCode !== 'undefined') {
            shouldReconnect = error.output.statusCode !== DisconnectReason.loggedOut;
        }
        console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        if (shouldReconnect) {
            connectToWhatsApp();
        }
    } else if (connection === 'open') {
        console.log('opened connection');
    }
}

function handleConnectionEvent(sock: WASocket, connectToWhatsApp: () => Promise<void>) {
    sock.ev.on('connection.update', (update) => {
        handleConnectionUpdate(sock, update, connectToWhatsApp);
    });
}

export { handleConnectionEvent };