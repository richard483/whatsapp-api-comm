import { useMultiFileAuthState, makeWASocket, WASocket, Browsers, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { handleEvent } from "../events";
import logger from "../logger";

type ConnState = 'connecting' | 'open' | 'close';

let sock: WASocket | null = null;
let connectionState: ConnState = 'connecting';
let lastQr: string | null = null;
let lastDisconnectReason: number | null = null;
let lastPairingCode: string | null = null;
let pairingCodeRequested = false;

function getAuthDir() {
  return path.resolve(process.env.WA_AUTH_DIR || path.join(process.cwd(), 'auth_info_baileys'));
}

async function requestPairingCodeIfNeeded(client: WASocket, registered: boolean) {
  if (registered || pairingCodeRequested) return;

  const phoneNumber = process.env.WA_NUMBER?.replace(/\D/g, '');
  if (!phoneNumber) {
    logger.warn('#connectToWhatsApp - no saved WhatsApp session and WA_NUMBER is not configured; scan the QR code from logs or /api/status');
    return;
  }

  try {
    pairingCodeRequested = true;
    const code = await client.requestPairingCode(phoneNumber);
    lastPairingCode = code;
    logger.info(`#connectToWhatsApp - WhatsApp pairing code for ${phoneNumber}: ${code}`);
  } catch (err: any) {
    pairingCodeRequested = false;
    logger.warn(`#connectToWhatsApp - failed to request pairing code - ${err?.message}`);
  }
}

async function connectToWhatsApp() {
  const authDir = getAuthDir();
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`#connectToWhatsApp - using WA v${version.join('.')}, isLatest: ${isLatest}`);
  logger.info(`#connectToWhatsApp - auth directory: ${authDir}`);

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
      requestPairingCodeIfNeeded(sock!, !!state.creds.registered).catch((err: any) => {
        logger.warn(`#connectToWhatsApp - failed to request pairing code - ${err?.message}`);
      });
    } else if (update.connection === 'open') {
      lastQr = null;
      lastPairingCode = null;
      pairingCodeRequested = false;
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
    lastPairingCode,
    lastDisconnectReason,
    me: sock?.user || null,
  };
}

export {
  connectToWhatsApp,
  getWaSocket,
  getConnectionStatus,
};
