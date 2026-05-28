/**
 * @openapi
 * /api/message:
 *   get:
 *     tags: [message]
 *     summary: List stored messages with keyset pagination
 *     parameters:
 *       - { in: query, name: contact_id, schema: { type: string, format: uuid } }
 *       - { in: query, name: group_id,   schema: { type: string, format: uuid } }
 *       - { in: query, name: since,      schema: { type: integer }, description: epoch seconds }
 *       - { in: query, name: until,      schema: { type: integer }, description: epoch seconds }
 *       - { in: query, name: limit,      schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: before_id,  schema: { type: string, format: uuid }, description: cursor }
 *     responses:
 *       200: { description: OK }
 * /api/message/{id}:
 *   get:
 *     tags: [message]
 *     summary: Fetch a single stored message by id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK }, 404: { description: Not found } }
 *   delete:
 *     tags: [message]
 *     summary: Revoke (delete-for-everyone) a message we sent
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK }, 403: { description: Not our message } }
 * /api/message/send:
 *   post:
 *     tags: [message]
 *     summary: Send a text message to a contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contact_id, message]
 *             properties:
 *               contact_id: { type: string, format: uuid }
 *               message: { type: string }
 *               quoted_message_id: { type: string, format: uuid, description: stored message id to reply to }
 *     responses: { 200: { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/SendResult' } } } } }
 * /api/message/send-group:
 *   post:
 *     tags: [message]
 *     summary: Send a text message to a group
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [group_id, message]
 *             properties:
 *               group_id: { type: string, format: uuid }
 *               message: { type: string }
 *               quoted_message_id: { type: string, format: uuid }
 *     responses: { 200: { description: OK } }
 * /api/message/send-media:
 *   post:
 *     tags: [media]
 *     summary: Send media (image / video / document) by base64 or URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_id: { type: string, format: uuid }
 *               group_id: { type: string, format: uuid }
 *               media_base64: { type: string, description: base64 of bytes (mutually exclusive with media_url) }
 *               media_url: { type: string, format: uri }
 *               mimetype: { type: string, description: required for media_base64; sniffed from Content-Type for media_url }
 *               file_name: { type: string }
 *               caption: { type: string }
 *               as_document: { type: boolean, default: false }
 *     responses: { 200: { description: OK } }
 * /api/message/send-audio:
 *   post:
 *     tags: [media]
 *     summary: Send audio or voice note (ptt)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contact_id: { type: string, format: uuid }
 *               group_id: { type: string, format: uuid }
 *               audio_base64: { type: string }
 *               audio_url: { type: string, format: uri }
 *               mimetype: { type: string, default: 'audio/ogg; codecs=opus' }
 *               ptt: { type: boolean, default: false, description: true to send as voice note }
 *               quoted_message_id: { type: string, format: uuid }
 *     responses: { 200: { description: OK } }
 * /api/message/send-poll:
 *   post:
 *     tags: [message]
 *     summary: Send a poll
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, values]
 *             properties:
 *               contact_id: { type: string, format: uuid }
 *               group_id: { type: string, format: uuid }
 *               name: { type: string }
 *               values: { type: array, minItems: 2, items: { type: string } }
 *               selectable_count: { type: integer, default: 1 }
 *     responses: { 200: { description: OK } }
 * /api/message/send-location:
 *   post:
 *     tags: [message]
 *     summary: Send a location pin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               contact_id: { type: string, format: uuid }
 *               group_id: { type: string, format: uuid }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               name: { type: string }
 *               address: { type: string }
 *     responses: { 200: { description: OK } }
 * /api/message/send-contact:
 *   post:
 *     tags: [message]
 *     summary: Send one or more contact cards (vcard)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contacts]
 *             properties:
 *               contact_id: { type: string, format: uuid }
 *               group_id: { type: string, format: uuid }
 *               contacts:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [display_name]
 *                   properties:
 *                     display_name: { type: string }
 *                     phone_number: { type: string }
 *                     vcard: { type: string, description: pass a complete vcard to override the generated one }
 *     responses: { 200: { description: OK } }
 * /api/message/{id}/edit:
 *   post:
 *     tags: [message]
 *     summary: Edit a message we previously sent
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [text], properties: { text: { type: string } } } } }
 *     responses: { 200: { description: OK }, 403: { description: Not our message } }
 * /api/message/{id}/read:
 *   post:
 *     tags: [message]
 *     summary: Mark an inbound message as read
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 * /api/message/{id}/react:
 *   post:
 *     tags: [message]
 *     summary: React to a message with an emoji (empty string removes)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [emoji], properties: { emoji: { type: string } } } } }
 *     responses: { 200: { description: OK } }
 * /api/message/{id}/forward:
 *   post:
 *     tags: [message]
 *     summary: Forward a stored message to a contact or group
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/Target' } } }
 *     responses: { 200: { description: OK }, 409: { description: Original message proto unavailable } }
 * /api/message/{id}/media:
 *   get:
 *     tags: [media]
 *     summary: Download the decrypted media of a stored inbound message
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: as, schema: { type: string, enum: [base64] }, description: omit for binary stream }
 *     responses:
 *       200:
 *         description: binary stream by default; base64-wrapped JSON when ?as=base64
 *         content:
 *           application/octet-stream: { schema: { type: string, format: binary } }
 *           application/json: { schema: { type: object, properties: { mimetype: { type: string }, file_name: { type: string }, size: { type: integer }, data_base64: { type: string } } } }
 *       409: { description: Raw proto unavailable for this row }
 */
import express from 'express';
import { Op } from 'sequelize';
import {
  sendMediaToContact,
  sendMediaToGroup,
  sendMessageToContact,
  sendMessageToGroup,
  sendAudioToTarget,
  sendPollToTarget,
  sendLocationToTarget,
  sendContactToTarget,
  resolveTargetJid,
} from '../messageService';
import { forwardWAMessage, sendReaction } from '../waClient';
import { Messages } from '../model/message';
import { getWaSocket } from '../config/baileys-config';
import { downloadMediaMessage, proto } from '@whiskeysockets/baileys';
import logger from '../logger';
const router = express.Router();

// Decode a stored row's raw_proto back into a WAMessage-like object.
function rebuildWAMessage(row: any): any | null {
  const b64 = row?.additional_data?.raw_proto;
  if (!b64) return null;
  try {
    return proto.WebMessageInfo.decode(Buffer.from(b64, 'base64'));
  } catch {
    return null;
  }
}

async function fetchUrlToBuffer(url: string): Promise<{ buffer: Buffer; mimetype: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch URL: HTTP ${resp.status}`);
  const arr = new Uint8Array(await resp.arrayBuffer());
  const mimetype = resp.headers.get('content-type') || 'application/octet-stream';
  return { buffer: Buffer.from(arr), mimetype };
}

// GET /api/message - history query with keyset pagination
// Query: contact_id, group_id, since (epoch sec), until (epoch sec), limit (default 50, max 200), before_id (uuid)
router.get('/', async (req, res) => {
  try {
    const { contact_id, group_id, since, until, before_id } = req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 200);

    const where: Record<string, any> = {};
    if (contact_id) where.contact_id = contact_id;
    if (group_id) where.group_id = group_id;

    const tsCond: Record<symbol, number> = {};
    if (since) tsCond[Op.gte] = parseInt(since, 10);
    if (until) tsCond[Op.lte] = parseInt(until, 10);
    if (Object.getOwnPropertySymbols(tsCond).length > 0) where.timestamp = tsCond;

    if (before_id) {
      const cursor = await Messages.findOne({ where: { id: before_id } });
      if (cursor) {
        where[Op.or as any] = [
          { timestamp: { [Op.lt]: cursor.timestamp } },
          { timestamp: cursor.timestamp, id: { [Op.lt]: cursor.id } },
        ];
      }
    }

    const rows = await Messages.findAll({
      where,
      order: [['timestamp', 'DESC'], ['id', 'DESC']],
      limit,
    });
    return res.json({ items: rows, next_before_id: rows.length === limit ? rows[rows.length - 1].id : null });
  } catch (err: any) {
    logger.error(`GET /api/message - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/message/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await Messages.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/send
// Body: { contact_id, message, quoted_message_id? }
router.post('/send', async (req, res) => {
  const { contact_id, message, quoted_message_id } = req.body;
  logger.info(`POST /api/message/send - contact_id: ${contact_id}`);
  if (!contact_id || !message) {
    logger.warn('Missing contact_id or message in request body');
    return res.status(400).json({ error: 'Missing contact_id or message' });
  }
  try {
    const result = await sendMessageToContact(contact_id, message, quoted_message_id);
    if (result.success) {
      logger.info(`Message sent successfully to contact_id: ${contact_id}`);
      return res.json({ success: true, message_id: (result as any).messageId });
    } else {
      logger.error(`Failed to send message to contact_id: ${contact_id} - ${result.error}`);
      return res.status(500).json({
        error: result.error,
        details: result.details,
        type: result.details?.type || 'MessageSendError',
        contact_id,
        message,
        stack: result.details?.stack || undefined,
      });
    }
  } catch (err: any) {
    logger.error(`Unexpected error sending message to contact_id: ${contact_id} - ${err?.message}`);
    return res.status(500).json({
      error: err?.message || 'Unexpected error',
      type: err?.type || 'InternalError',
      contact_id,
      message,
      stack: err?.stack || undefined,
    });
  }
});

// POST /api/message/send-group
// Body: { group_id, message, quoted_message_id? }
router.post('/send-group', async (req, res) => {
  const { group_id, message, quoted_message_id } = req.body;
  logger.info(`POST /api/message/send-group - group_id: ${group_id}`);
  if (!group_id || !message) {
    logger.warn('Missing group_id or message in request body');
    return res.status(400).json({ error: 'Missing group_id or message' });
  }
  try {
    const result = await sendMessageToGroup(group_id, message, quoted_message_id);
    if (result.success) {
      logger.info(`Message sent successfully to group_id: ${group_id}`);
      return res.json({ success: true, message_id: (result as any).messageId });
    } else {
      logger.error(`Failed to send message to group_id: ${group_id} - ${result.error}`);
      return res.status(500).json({
        error: result.error,
        details: result.details,
        type: result.details?.type || 'MessageSendError',
        group_id,
        message,
        stack: result.details?.stack || undefined,
      });
    }
  } catch (err: any) {
    logger.error(`Unexpected error sending message to group_id: ${group_id} - ${err?.message}`);
    return res.status(500).json({
      error: err?.message || 'Unexpected error',
      type: err?.type || 'InternalError',
      group_id,
      message,
      stack: err?.stack || undefined,
    });
  }
});

// POST /api/message/send-media
// Body: { contact_id?, group_id?, media_base64?, media_url?, mimetype?, file_name?, caption?, as_document? }
// Exactly one of media_base64 / media_url required. mimetype is required for media_base64; optional for media_url (sniffed from Content-Type).
router.post('/send-media', async (req, res) => {
  const { contact_id, group_id, media_base64, media_url, mimetype, file_name, caption, as_document } = req.body || {};
  if (!contact_id && !group_id) return res.status(400).json({ error: 'Missing contact_id or group_id' });
  if (contact_id && group_id) return res.status(400).json({ error: 'Use either contact_id or group_id, not both' });
  if (!media_base64 && !media_url) return res.status(400).json({ error: 'Provide media_base64 or media_url' });
  if (media_base64 && media_url) return res.status(400).json({ error: 'Use either media_base64 or media_url, not both' });

  try {
    let media: Buffer;
    let resolvedMime = mimetype as string | undefined;
    if (media_url) {
      const fetched = await fetchUrlToBuffer(String(media_url));
      media = fetched.buffer;
      resolvedMime = resolvedMime || fetched.mimetype;
    } else {
      media = Buffer.from(String(media_base64), 'base64');
    }
    if (!media.length) return res.status(400).json({ error: 'media resolved to an empty buffer' });
    if (!resolvedMime) return res.status(400).json({ error: 'mimetype required when using media_base64' });

    const result = contact_id
      ? await sendMediaToContact(contact_id, media, resolvedMime, file_name, caption, !!as_document)
      : await sendMediaToGroup(group_id, media, resolvedMime, file_name, caption, !!as_document);

    if (result.success) {
      return res.json({ success: true, message_id: (result as any).messageId });
    }
    return res.status(500).json({
      error: result.error,
      details: result.details,
      type: result.details?.type || 'MediaSendError',
    });
  } catch (err: any) {
    logger.error(`Unexpected error sending media - ${err?.message}`);
    return res.status(500).json({
      error: err?.message || 'Unexpected error',
      type: err?.type || 'InternalError',
      stack: err?.stack || undefined,
    });
  }
});

// POST /api/message/:id/edit - edit a previously sent message (must be ours)
// Body: { text: string }
router.post('/:id/edit', async (req, res) => {
  try {
    const sock = getWaSocket();
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text required' });

    const row = await Messages.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Message not found' });
    if (!row.from_me) return res.status(403).json({ error: 'Cannot edit a message that was not sent by us' });

    const key = {
      remoteJid: row.remote_jid,
      fromMe: true,
      id: row.whatsapp_message_id,
      participant: row.participant_jid || undefined,
    };
    const result = await sock.sendMessage(row.remote_jid, { text, edit: key });

    // Apply the edit locally so the DB reflects the new state immediately,
    // independent of whether/when the messages.update echo fires.
    const prior = row.additional_data || {};
    const history = Array.isArray(prior.edit_history) ? prior.edit_history : [];
    history.push({
      edited_at: new Date().toISOString(),
      message_type: row.message_type,
      message_text: row.message_text,
      additional_data: { ...prior, edit_history: undefined },
    });
    await row.update({
      message_text: text,
      message_type: 'conversation',
      additional_data: { ...prior, content_type: 'conversation', edit_history: history },
    });

    return res.json({ success: true, message_id: result?.key?.id || null });
  } catch (err: any) {
    logger.error(`POST /api/message/:id/edit - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// DELETE /api/message/:id - revoke (delete-for-everyone) a previously sent message (must be ours)
router.delete('/:id', async (req, res) => {
  try {
    const sock = getWaSocket();
    const row = await Messages.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Message not found' });
    if (!row.from_me) return res.status(403).json({ error: 'Cannot revoke a message that was not sent by us' });

    const key = {
      remoteJid: row.remote_jid,
      fromMe: true,
      id: row.whatsapp_message_id,
      participant: row.participant_jid || undefined,
    };
    await sock.sendMessage(row.remote_jid, { delete: key });
    await row.update({ revoked_at: new Date() });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error(`DELETE /api/message/:id - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/message/:id/media - download decrypted media for a stored message.
// Streams binary by default; pass ?as=base64 for a JSON wrapper.
router.get('/:id/media', async (req, res) => {
  try {
    const sock = getWaSocket();
    const row = await Messages.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Message not found' });

    const waMessage = rebuildWAMessage(row);
    if (!waMessage) {
      return res.status(409).json({ error: 'Original message proto is unavailable for this row (predates raw-proto persistence or non-media).' });
    }

    const buffer = (await downloadMediaMessage(
      waMessage,
      'buffer',
      {},
      { logger: logger as any, reuploadRequest: sock.updateMediaMessage },
    )) as Buffer;

    const mediaMeta = row.additional_data?.media || {};
    const mimetype = mediaMeta.mimetype || 'application/octet-stream';
    const fileName = mediaMeta.file_name || `media-${row.whatsapp_message_id}`;

    if ((req.query.as as string) === 'base64') {
      return res.json({
        message_id: row.id,
        mimetype,
        file_name: fileName,
        size: buffer.length,
        data_base64: buffer.toString('base64'),
      });
    }

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.end(buffer);
  } catch (err: any) {
    logger.error(`GET /api/message/:id/media - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/:id/react - react to a stored message with an emoji ('' removes the reaction)
// Body: { emoji: string }
router.post('/:id/react', async (req, res) => {
  try {
    const { emoji } = req.body || {};
    if (typeof emoji !== 'string') return res.status(400).json({ error: 'emoji (string, may be empty) required' });
    const row = await Messages.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Message not found' });

    const result = await sendReaction(
      {
        remoteJid: row.remote_jid,
        fromMe: row.from_me,
        id: row.whatsapp_message_id,
        participant: row.participant_jid || undefined,
      },
      emoji,
    );
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.json({ success: true, message_id: (result as any).messageId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/:id/forward - forward a stored message to a contact or group.
// Body: { contact_id?, group_id? } (exactly one)
router.post('/:id/forward', async (req, res) => {
  try {
    const { contact_id, group_id } = req.body || {};
    const { jid, error } = await resolveTargetJid({ contact_id, group_id });
    if (error) return res.status(400).json({ error });

    const row = await Messages.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Message not found' });
    const waMessage = rebuildWAMessage(row);
    if (!waMessage) {
      return res.status(409).json({ error: 'Cannot forward: original message proto unavailable. For text rows you can re-send via /send.' });
    }

    const result = await forwardWAMessage(jid!, waMessage);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.json({ success: true, message_id: (result as any).messageId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/send-audio - send an audio or voice note (ptt)
// Body: { contact_id?, group_id?, audio_base64?, audio_url?, mimetype?, ptt?, quoted_message_id? }
router.post('/send-audio', async (req, res) => {
  try {
    const { contact_id, group_id, audio_base64, audio_url, mimetype, ptt, quoted_message_id } = req.body || {};
    if (!audio_base64 && !audio_url) return res.status(400).json({ error: 'Provide audio_base64 or audio_url' });

    let buffer: Buffer;
    let resolvedMime = mimetype as string | undefined;
    if (audio_url) {
      const fetched = await fetchUrlToBuffer(String(audio_url));
      buffer = fetched.buffer;
      resolvedMime = resolvedMime || fetched.mimetype;
    } else {
      buffer = Buffer.from(String(audio_base64), 'base64');
    }
    if (!buffer.length) return res.status(400).json({ error: 'audio resolved to an empty buffer' });

    const result = await sendAudioToTarget(
      { contact_id, group_id },
      buffer,
      resolvedMime || 'audio/ogg; codecs=opus',
      !!ptt,
      quoted_message_id,
    );
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.json({ success: true, message_id: (result as any).messageId });
  } catch (err: any) {
    logger.error(`POST /api/message/send-audio - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/send-poll
// Body: { contact_id?, group_id?, name, values: string[], selectable_count? }
router.post('/send-poll', async (req, res) => {
  try {
    const { contact_id, group_id, name, values, selectable_count } = req.body || {};
    if (!name || !Array.isArray(values) || values.length < 2) {
      return res.status(400).json({ error: 'name and at least 2 values required' });
    }
    const result = await sendPollToTarget(
      { contact_id, group_id },
      String(name),
      values.map((v: any) => String(v)),
      Number(selectable_count) || 1,
    );
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.json({ success: true, message_id: (result as any).messageId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/send-location
// Body: { contact_id?, group_id?, latitude, longitude, name?, address? }
router.post('/send-location', async (req, res) => {
  try {
    const { contact_id, group_id, latitude, longitude, name, address } = req.body || {};
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'latitude and longitude (numbers) required' });
    }
    const result = await sendLocationToTarget({ contact_id, group_id }, lat, lng, name, address);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.json({ success: true, message_id: (result as any).messageId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/send-contact
// Body: { contact_id?, group_id?, contacts: [{ display_name, phone_number?, vcard? }] }
router.post('/send-contact', async (req, res) => {
  try {
    const { contact_id, group_id, contacts } = req.body || {};
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts (non-empty array) required' });
    }
    const built = contacts.map((c: any) => ({
      displayName: c.display_name || c.displayName,
      phoneNumber: c.phone_number || c.phoneNumber,
      vcard: c.vcard,
    }));
    if (built.some((c) => !c.displayName)) {
      return res.status(400).json({ error: 'each contact requires display_name' });
    }
    const result = await sendContactToTarget({ contact_id, group_id }, built);
    if (!result.success) return res.status(500).json({ error: result.error });
    return res.json({ success: true, message_id: (result as any).messageId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/message/:id/read - mark an inbound message as read
router.post('/:id/read', async (req, res) => {
  try {
    const sock = getWaSocket();
    const row = await Messages.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Message not found' });
    if (row.from_me) return res.status(400).json({ error: 'Cannot mark our own message as read' });

    await sock.readMessages([{
      remoteJid: row.remote_jid,
      fromMe: false,
      id: row.whatsapp_message_id,
      participant: row.participant_jid || undefined,
    }]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;
