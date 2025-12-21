
import { Contacts } from './model/contact';
import { Groups } from './model/group';
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

// Send a message to a group by group_id
export async function sendMessageToGroup(groupId: string, message: string) {
  logger.info(`Attempting to send message to group_id: ${groupId}`);
  const group = await Groups.findByPk(groupId);
  if (!group || !group.whatsapp_jid) {
    logger.error(`Group not found or missing WhatsApp JID for group_id: ${groupId}`);
    return {
      success: false,
      error: 'Group not found or missing WhatsApp JID',
      details: { groupId },
    };
  }
  const jid = group.whatsapp_jid;
  const result = await sendTextMessage(jid, message);
  if (result.success) {
    logger.info(`Message sent to group JID: ${jid}, messageId: ${result.messageId}`);
  } else {
    logger.error(`Failed to send message to group JID: ${jid}, error: ${result.error}`);
  }
  return result;
}