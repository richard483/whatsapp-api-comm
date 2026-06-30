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

async function requestPairingCodeIfNeeded(client: WASocket, registered: boolean, saveCreds: () => Promise<void>) {
  if (registered || pairingCodeRequested) return;

  const phoneNumber = process.env.WA_NUMBER?.replace(/\D/g, '');
  if (!phoneNumber) {
    logger.warn('#connectToWhatsApp - no saved WhatsApp session and WA_NUMBER is not configured; scan the QR code from logs or /api/status');
    return;
  }

  try {
    pairingCodeRequested = true;
    logger.info(`#connectToWhatsApp - waiting for WhatsApp socket before requesting pairing code for ${phoneNumber}`);
    await client.waitForSocketOpen();
    const code = await client.requestPairingCode(phoneNumber);
    lastPairingCode = code;
    logger.info(`#connectToWhatsApp - WhatsApp pairing code for ${phoneNumber}: ${code}`);
  } catch (err: any) {
    pairingCodeRequested = false;
    const creds = client.authState.creds as any;
    if (!client.authState.creds.registered) {
      delete creds.me;
      delete creds.pairingCode;
      await saveCreds();
    }
    logger.warn(`#connectToWhatsApp - failed to request pairing code - ${err?.message}`);
  }
}

async function connectToWhatsApp() {
  const authDir = getAuthDir();
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  if (!state.creds.registered && (state.creds.me || state.creds.pairingCode)) {
    const creds = state.creds as any;
    delete creds.me;
    delete creds.pairingCode;
    await saveCreds();
    lastPairingCode = null;
    logger.warn('#connectToWhatsApp - cleared incomplete WhatsApp pairing credentials');
  }

  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`#connectToWhatsApp - using WA v${version.join('.')}, isLatest: ${isLatest}`);
  logger.info(`#connectToWhatsApp - auth directory: ${authDir}`);

  connectionState = 'connecting';
  const isRegistered = !!state.creds.registered;

  sock = makeWASocket({
    auth: state,
    version,
    syncFullHistory: isRegistered,
    browser: isRegistered ? Browsers.macOS('Desktop') : Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
  });

  sock.ev.on('connection.update', (update) => {
    if (update.connection) {
      connectionState = update.connection as ConnState;
    }
    if (update.qr) {
      lastQr = update.qr;
      requestPairingCodeIfNeeded(sock!, isRegistered, saveCreds).catch((err: any) => {
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
