import { useMultiFileAuthState, makeWASocket, WASocket, Browsers, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { handleEvent } from "../events";
import logger from "../logger";

let sock: WASocket | null = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`#connectToWhatsApp - using WA v${version.join('.')}, isLatest: ${isLatest}`);

  sock = makeWASocket({
    auth: state,
    version,
    // enable full history sync automatically on first connect
    syncFullHistory: true,
    // emulate desktop for larger history chunks
    browser: Browsers.macOS('Desktop'),
    markOnlineOnConnect: false,
  });

  handleEvent(sock, connectToWhatsApp, saveCreds);
}

function getWaSocket(): WASocket {
  return sock!;
}

export {
  connectToWhatsApp,
  getWaSocket,
};
