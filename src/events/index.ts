import { WASocket } from "@whiskeysockets/baileys";
import { handleMessagesEvent } from "./messages-event";
import { handleConnectionEvent } from "./connection-event";
import { handleCredsEvent } from "./creds-event";
import { handleGroupsEvent } from "./groups-event";

function handleEvent(sock: WASocket, connectToWhatsApp: () => Promise<void>, saveCreds: () => Promise<void>) {

  handleMessagesEvent(sock);
  handleConnectionEvent(sock, connectToWhatsApp);
  handleCredsEvent(sock, saveCreds);
  handleGroupsEvent(sock);
}

export { handleEvent };
