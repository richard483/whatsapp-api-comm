import logger from './logger';
import { getWaSocket } from './config/baileys-config';


// Send a text message to a WhatsApp JID
export async function sendTextMessage(jid: string, text: string) {
  const client = getWaSocket();
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