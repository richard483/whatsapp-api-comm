import { useMultiFileAuthState, makeWASocket, WASocket, Browsers } from "@whiskeysockets/baileys";
import { handleEvent } from "../events";

let sock: WASocket | null = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  sock = makeWASocket({
    auth: state,
    // enable full history sync automatically on first connect
    syncFullHistory: true,
    // @ts-ignore
    cachedGroupMetadata: true,
    // emulate desktop for larger history chunks
    browser: Browsers.macOS('Desktop'),
    version: [2, 3000, 1025190524],
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
