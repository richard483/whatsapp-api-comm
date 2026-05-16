import logger from './logger';
import { getWaSocket } from './config/baileys-config';
import { Messages } from './model/message';
import { Contacts } from './model/contact';
import { Groups } from './model/group';

type MediaSendParams = {
  buffer: Buffer;
  mimetype: string;
  fileName?: string | null;
  caption?: string | null;
  asDocument?: boolean;
};

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

// Send an image/document to a WhatsApp JID and persist an outbound row immediately.
export async function sendMediaMessage(jid: string, params: MediaSendParams) {
  const client = getWaSocket();
  const isImage = params.mimetype.startsWith('image/') && !params.asDocument;
  const payload = isImage
    ? {
        image: params.buffer,
        mimetype: params.mimetype,
        caption: params.caption || undefined,
      }
    : {
        document: params.buffer,
        mimetype: params.mimetype,
        fileName: params.fileName || 'attachment',
        caption: params.caption || undefined,
      };

  try {
    const result = await client.sendMessage(jid, payload);
    const messageId = result?.key?.id || null;
    logger.info(`Media message sent to JID: ${jid}, messageId: ${messageId}`);

    if (result?.key?.id) {
      await persistOutboundMedia(jid, params, result, isImage ? 'imageMessage' : 'documentMessage');
    }

    return { success: true, messageId };
  } catch (error: any) {
    logger.error(`Failed to send media message to JID: ${jid} - ${error?.message}`);
    return {
      success: false,
      error: error?.message || 'Failed to send media message',
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

async function persistOutboundMedia(jid: string, params: MediaSendParams, result: any, messageType: string) {
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
      message_type: messageType,
      message_text: params.caption || null,
      push_name_snapshot: null,
      is_group: isGroup,
      from_me: true,
      status: 'PENDING',
      additional_data: {
        content_type: messageType,
        source: 'api',
        media: {
          mimetype: params.mimetype,
          file_name: params.fileName || null,
          file_length: params.buffer.length,
        },
      },
    });
  } catch (err: any) {
    if (err?.name !== 'SequelizeUniqueConstraintError') {
      logger.warn(`#persistOutboundMedia - failed to insert outbound row - ${err?.message}`);
    }
  }
}
