import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import logger from './logger';

// Path to auth_info_baileys for session persistence
const AUTH_FOLDER = 'auth_info_baileys';

let sock: ReturnType<typeof makeWASocket> | null = null;

// Initialize Baileys client
export async function initWaClient() {
  if (sock) return sock;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    logger.info(`WhatsApp connection update: ${connection}`);
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== 401;
      logger.warn(`WhatsApp connection closed. Should reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        initWaClient();
      }
    }
  });
  return sock;
}

// Send a text message to a WhatsApp JID
export async function sendTextMessage(jid: string, text: string) {
  const client = await initWaClient();
  try {
    const result = await client.sendMessage(jid, { text });
    const messageId = result?.key?.id || null;
    logger.info(`Text message sent to JID: ${jid}, messageId: ${messageId}`);
    return { success: true, messageId };
  } catch (error: any) {
    logger.error(`Failed to send text message to JID: ${jid} - ${error?.message}`);
    return {
      success: false,
      error: error?.message || 'Failed to send message',
      details: error,
    };
  }
}