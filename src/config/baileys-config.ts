import { useMultiFileAuthState, makeWASocket, WASocket } from "baileys";
import { handleEvent } from "../events";

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const sock: WASocket = makeWASocket({
    auth: state,
  });

  handleEvent(sock, connectToWhatsApp, saveCreds);
}

export {
  connectToWhatsApp
};
