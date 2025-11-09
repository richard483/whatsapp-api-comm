import { useMultiFileAuthState, makeWASocket, WASocket, Browsers } from "baileys";
import { handleEvent } from "../events";

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const sock: WASocket = makeWASocket({
    auth: state,
    // enable full history sync automatically on first connect
    syncFullHistory: true,
    // emulate desktop for larger history chunks
    browser: Browsers.macOS('Desktop'),
  });

  handleEvent(sock, connectToWhatsApp, saveCreds);
}

export {
  connectToWhatsApp
};
