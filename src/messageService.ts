
import { Contacts } from './model/contact';
import { Groups } from './model/group';
import {
  sendMediaMessage,
  sendTextMessage,
  sendAudioMessage,
  sendPoll,
  sendLocation,
  sendContactCard,
  buildQuotedFromRowId,
} from './waClient';
import logger from './logger';

// Resolve { contact_id, group_id } => target JID. Exactly one must be set.
export async function resolveTargetJid(opts: { contact_id?: string | null; group_id?: string | null }): Promise<{ jid?: string; error?: string }> {
  const { contact_id, group_id } = opts;
  if ((!contact_id && !group_id) || (contact_id && group_id)) {
    return { error: 'Provide exactly one of contact_id or group_id' };
  }
  if (contact_id) {
    const c = await Contacts.findByPk(contact_id);
    if (!c?.whatsapp_jid) return { error: 'Contact not found or missing WhatsApp JID' };
    return { jid: c.whatsapp_jid };
  }
  const g = await Groups.findByPk(group_id!);
  if (!g?.whatsapp_jid) return { error: 'Group not found or missing WhatsApp JID' };
  return { jid: g.whatsapp_jid };
}

// Send a message to a contact by contact_id
export async function sendMessageToContact(contactId: string, message: string, quotedMessageId?: string | null) {
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
  const quoted = quotedMessageId ? await buildQuotedFromRowId(quotedMessageId) : undefined;
  const result = await sendTextMessage(jid, message, { quoted });
  if (result.success) {
    logger.info(`Message sent to JID: ${jid}, messageId: ${result.messageId}`);
  } else {
    logger.error(`Failed to send message to JID: ${jid}, error: ${result.error}`);
  }
  return result;
}

export async function sendMediaToContact(
  contactId: string,
  media: Buffer,
  mimetype: string,
  fileName?: string | null,
  caption?: string | null,
  asDocument?: boolean,
) {
  logger.info(`Attempting to send media to contact_id: ${contactId}`);
  const contact = await Contacts.findByPk(contactId);
  if (!contact || !contact.whatsapp_jid) {
    logger.error(`Contact not found or missing WhatsApp JID for contact_id: ${contactId}`);
    return {
      success: false,
      error: 'Contact not found or missing WhatsApp JID',
      details: { contactId },
    };
  }

  return sendMediaMessage(contact.whatsapp_jid, {
    buffer: media,
    mimetype,
    fileName,
    caption,
    asDocument,
  });
}

// Send a message to a group by group_id
export async function sendMessageToGroup(groupId: string, message: string, quotedMessageId?: string | null) {
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
  const quoted = quotedMessageId ? await buildQuotedFromRowId(quotedMessageId) : undefined;
  const result = await sendTextMessage(jid, message, { quoted });
  if (result.success) {
    logger.info(`Message sent to group JID: ${jid}, messageId: ${result.messageId}`);
  } else {
    logger.error(`Failed to send message to group JID: ${jid}, error: ${result.error}`);
  }
  return result;
}

export async function sendMediaToGroup(
  groupId: string,
  media: Buffer,
  mimetype: string,
  fileName?: string | null,
  caption?: string | null,
  asDocument?: boolean,
) {
  logger.info(`Attempting to send media to group_id: ${groupId}`);
  const group = await Groups.findByPk(groupId);
  if (!group || !group.whatsapp_jid) {
    logger.error(`Group not found or missing WhatsApp JID for group_id: ${groupId}`);
    return {
      success: false,
      error: 'Group not found or missing WhatsApp JID',
      details: { groupId },
    };
  }

  return sendMediaMessage(group.whatsapp_jid, {
    buffer: media,
    mimetype,
    fileName,
    caption,
    asDocument,
  });
}

export async function sendAudioToTarget(
  target: { contact_id?: string | null; group_id?: string | null },
  buffer: Buffer,
  mimetype: string,
  ptt: boolean,
  quotedMessageId?: string | null,
) {
  const { jid, error } = await resolveTargetJid(target);
  if (error) return { success: false, error };
  return sendAudioMessage(jid!, buffer, mimetype, ptt, {
    quoted: quotedMessageId ? await buildQuotedFromRowId(quotedMessageId) : undefined,
  });
}

export async function sendPollToTarget(
  target: { contact_id?: string | null; group_id?: string | null },
  name: string,
  values: string[],
  selectableCount: number,
) {
  const { jid, error } = await resolveTargetJid(target);
  if (error) return { success: false, error };
  return sendPoll(jid!, name, values, selectableCount);
}

export async function sendLocationToTarget(
  target: { contact_id?: string | null; group_id?: string | null },
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
) {
  const { jid, error } = await resolveTargetJid(target);
  if (error) return { success: false, error };
  return sendLocation(jid!, latitude, longitude, name, address);
}

export async function sendContactToTarget(
  target: { contact_id?: string | null; group_id?: string | null },
  contacts: Array<{ displayName: string; phoneNumber?: string; vcard?: string }>,
) {
  const { jid, error } = await resolveTargetJid(target);
  if (error) return { success: false, error };
  return sendContactCard(jid!, contacts);
}
