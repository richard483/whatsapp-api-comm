
import { Contacts } from './model/contact';
import { sendTextMessage } from './waClient';
import logger from './logger';

// Send a message to a contact by contact_id
export async function sendMessageToContact(contactId: string, message: string) {
  logger.info(`Attempting to send message to contact_id: ${contactId}`);
  const contact = await Contacts.findByPk(contactId);
  if (!contact || !contact.whatsapp_jid) {
    logger.error(`Contact not found or missing WhatsApp JID for contact_id: ${contactId}`);
    return {
      success: false,
      error: 'Contact not found or missing WhatsApp JID',
      details: { contactId },
    };
  }
  const jid = contact.whatsapp_jid;
  const result = await sendTextMessage(jid, message);
  if (result.success) {
    logger.info(`Message sent to JID: ${jid}, messageId: ${result.messageId}`);
  } else {
    logger.error(`Failed to send message to JID: ${jid}, error: ${result.error}`);
  }
  return result;
}