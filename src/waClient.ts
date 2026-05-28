import logger from './logger';
import { getWaSocket } from './config/baileys-config';
import { Messages } from './model/message';
import { Contacts } from './model/contact';
import { Groups } from './model/group';
import { proto } from '@whiskeysockets/baileys';

// Encode a sendMessage result (a WAMessage / WebMessageInfo) to a base64 proto so
// that downstream endpoints (GET /:id/media, POST /:id/forward) can reconstruct
// the original message and decrypt media or forward content. Returns null if
// the result is missing or cannot be serialized.
function encodeRawProto(result: any): string | null {
  if (!result) return null;
  try {
    const bytes = proto.WebMessageInfo.encode(result).finish();
    return Buffer.from(bytes).toString('base64');
  } catch (err: any) {
    logger.warn(`#encodeRawProto - failed to encode send result - ${err?.message}`);
    return null;
  }
}

type MediaSendParams = {
  buffer: Buffer;
  mimetype: string;
  fileName?: string | null;
  caption?: string | null;
  asDocument?: boolean;
};

type SendOptions = {
  quoted?: any; // WAMessage to quote (reply)
};

// Build a stub WAMessage from a stored DB row to be used as the `quoted` field on sendMessage.
export async function buildQuotedFromRowId(messageId: string): Promise<any | null> {
  const row = await Messages.findByPk(messageId);
  if (!row) return null;
  return {
    key: {
      remoteJid: row.remote_jid,
      fromMe: row.from_me,
      id: row.whatsapp_message_id,
      participant: row.participant_jid || undefined,
    },
    message: row.message_text ? { conversation: row.message_text } : {},
  };
}

// Send a text message to a WhatsApp JID and persist an outbound row immediately.
export async function sendTextMessage(jid: string, text: string, options: SendOptions = {}) {
  const client = getWaSocket();
  try {
    const result = await client.sendMessage(jid, { text }, options.quoted ? { quoted: options.quoted } : undefined);
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

// Send an image/document/video to a WhatsApp JID and persist an outbound row immediately.
export async function sendMediaMessage(jid: string, params: MediaSendParams, options: SendOptions = {}) {
  const client = getWaSocket();
  const isImage = params.mimetype.startsWith('image/') && !params.asDocument;
  const isVideo = params.mimetype.startsWith('video/') && !params.asDocument;
  const payload: any = isImage
    ? { image: params.buffer, mimetype: params.mimetype, caption: params.caption || undefined }
    : isVideo
    ? { video: params.buffer, mimetype: params.mimetype, caption: params.caption || undefined }
    : {
        document: params.buffer,
        mimetype: params.mimetype,
        fileName: params.fileName || 'attachment',
        caption: params.caption || undefined,
      };

  try {
    const result = await client.sendMessage(jid, payload, options.quoted ? { quoted: options.quoted } : undefined);
    const messageId = result?.key?.id || null;
    logger.info(`Media message sent to JID: ${jid}, messageId: ${messageId}`);

    const recordedType = isImage ? 'imageMessage' : isVideo ? 'videoMessage' : 'documentMessage';
    if (result?.key?.id) {
      await persistOutboundMedia(jid, params, result, recordedType);
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
      additional_data: { content_type: 'conversation', source: 'api', raw_proto: encodeRawProto(result) },
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
        raw_proto: encodeRawProto(result),
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

// Send a voice note / audio. ptt=true sends as voice note.
export async function sendAudioMessage(jid: string, buffer: Buffer, mimetype: string, ptt: boolean, options: SendOptions = {}) {
  const client = getWaSocket();
  try {
    const result = await client.sendMessage(
      jid,
      { audio: buffer, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: !!ptt },
      options.quoted ? { quoted: options.quoted } : undefined,
    );
    return { success: true, messageId: result?.key?.id || null };
  } catch (error: any) {
    logger.error(`Failed to send audio to JID: ${jid} - ${error?.message}`);
    return { success: false, error: error?.message || 'Failed to send audio', details: error };
  }
}

// Send a reaction to an existing WAMessage key. Empty emoji removes the reaction.
export async function sendReaction(targetKey: any, emoji: string) {
  const client = getWaSocket();
  try {
    const result = await client.sendMessage(targetKey.remoteJid, {
      react: { text: emoji || '', key: targetKey },
    });
    return { success: true, messageId: result?.key?.id || null };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send reaction', details: error };
  }
}

// Forward an already-received WAMessage (rebuilt from raw_proto) to a new JID.
export async function forwardWAMessage(toJid: string, waMessage: any) {
  const client = getWaSocket();
  try {
    const result = await client.sendMessage(toJid, { forward: waMessage });
    return { success: true, messageId: result?.key?.id || null };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to forward', details: error };
  }
}

export async function sendPoll(jid: string, name: string, values: string[], selectableCount: number = 1) {
  const client = getWaSocket();
  try {
    const result = await client.sendMessage(jid, {
      poll: { name, values, selectableCount: Math.max(1, selectableCount) },
    } as any);
    return { success: true, messageId: result?.key?.id || null };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send poll', details: error };
  }
}

export async function sendLocation(jid: string, latitude: number, longitude: number, name?: string, address?: string) {
  const client = getWaSocket();
  try {
    const result = await client.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: name || undefined,
        address: address || undefined,
      },
    });
    return { success: true, messageId: result?.key?.id || null };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send location', details: error };
  }
}

// Send a contact card. Pass either a ready-made vcard or { displayName, phoneNumber } and we will build one.
export async function sendContactCard(
  jid: string,
  contacts: Array<{ displayName: string; phoneNumber?: string; vcard?: string }>,
) {
  const client = getWaSocket();
  try {
    const built = contacts.map((c) => ({
      displayName: c.displayName,
      vcard:
        c.vcard ||
        `BEGIN:VCARD\nVERSION:3.0\nFN:${c.displayName}\nTEL;type=CELL;type=VOICE;waid=${(c.phoneNumber || '').replace(/[^\d]/g, '')}:${c.phoneNumber || ''}\nEND:VCARD`,
    }));
    const result = await client.sendMessage(jid, {
      contacts: { displayName: built[0]?.displayName || 'Contacts', contacts: built },
    });
    return { success: true, messageId: result?.key?.id || null };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send contact', details: error };
  }
}
