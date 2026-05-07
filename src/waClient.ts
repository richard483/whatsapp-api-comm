import logger from './logger';
import { getWaSocket } from './config/baileys-config';
import { Messages } from './model/message';
import { Contacts } from './model/contact';
import { Groups } from './model/group';

// Send a text message to a WhatsApp JID and persist an outbound row immediately.
export async function sendTextMessage(jid: string, text: string) {
  const client = getWaSocket();
  try {
    const result = await client.sendMessage(jid, { text });
    const messageId = result?.key?.id || null;
    logger.info(`Text message sent to JID: ${jid}, messageId: ${messageId}`);

    if (result?.key?.id) {
      await persistOutbound(jid, text, result);
    }

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

async function persistOutbound(jid: string, text: string, result: any) {
  try {
    const isGroup = jid.endsWith('@g.us');
    let contactId: string | null = null;
    let groupId: string | null = null;
    if (isGroup) {
      const group = await Groups.findOne({ where: { whatsapp_jid: jid } });
      groupId = group?.id || null;
    } else {
      const contact = await Contacts.findOne({ where: { whatsapp_jid: jid } });
      contactId = contact?.id || null;
    }

    await Messages.create({
      whatsapp_message_id: result.key.id,
      remote_jid: jid,
      participant_jid: null,
      contact_id: contactId,
      sender_contact_id: null,
      group_id: groupId,
      timestamp: Number(result.messageTimestamp) || Math.floor(Date.now() / 1000),
      message_type: 'conversation',
      message_text: text,
      push_name_snapshot: null,
      is_group: isGroup,
      from_me: true,
      status: 'PENDING',
      additional_data: { content_type: 'conversation', source: 'api' },
    });
  } catch (err: any) {
    // The Baileys upsert echo can win the race and insert first — that's fine.
    if (err?.name !== 'SequelizeUniqueConstraintError') {
      logger.warn(`#persistOutbound - failed to insert outbound row - ${err?.message}`);
    }
  }
}
