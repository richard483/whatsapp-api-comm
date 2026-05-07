import { useMultiFileAuthState, makeWASocket, WASocket, Browsers, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { handleEvent } from "../events";
import logger from "../logger";

type ConnState = 'connecting' | 'open' | 'close';

let sock: WASocket | null = null;
let connectionState: ConnState = 'connecting';
let lastQr: string | null = null;
let lastDisconnectReason: number | null = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`#connectToWhatsApp - using WA v${version.join('.')}, isLatest: ${isLatest}`);

  connectionState = 'connecting';

  sock = makeWASocket({
    auth: state,
    version,
    // enable full history sync automatically on first connect
    syncFullHistory: true,
    // emulate desktop for larger history chunks
    browser: Browsers.macOS('Desktop'),
    markOnlineOnConnect: false,
  });

  sock.ev.on('connection.update', (update) => {
    if (update.connection) {
      connectionState = update.connection as ConnState;
    }
    if (update.qr) {
      lastQr = update.qr;
    } else if (update.connection === 'open') {
      lastQr = null;
    }
    const status = (update.lastDisconnect?.error as any)?.output?.statusCode;
    if (typeof status === 'number') {
      lastDisconnectReason = status;
    }
  });

  handleEvent(sock, connectToWhatsApp, saveCreds);
}

function getWaSocket(): WASocket {
  return sock!;
}

function getConnectionStatus() {
  return {
    state: connectionState,
    lastQr,
    lastDisconnectReason,
    me: sock?.user || null,
  };
}

export {
  connectToWhatsApp,
  getWaSocket,
  getConnectionStatus,
};
