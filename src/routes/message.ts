import express from 'express';
import { Op } from 'sequelize';
import { sendMessageToContact, sendMessageToGroup } from '../messageService';
import { Messages } from '../model/message';
import { getWaSocket } from '../config/baileys-config';
import logger from '../logger';
const router = express.Router();

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
router.post('/send', async (req, res) => {
  const { contact_id, message } = req.body;
  logger.info(`POST /api/message/send - contact_id: ${contact_id}`);
  if (!contact_id || !message) {
    logger.warn('Missing contact_id or message in request body');
    return res.status(400).json({ error: 'Missing contact_id or message' });
  }
  try {
    const result = await sendMessageToContact(contact_id, message);
    if (result.success) {
      logger.info(`Message sent successfully to contact_id: ${contact_id}`);
      return res.json({ success: true, message_id: result.messageId });
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
router.post('/send-group', async (req, res) => {
  const { group_id, message } = req.body;
  logger.info(`POST /api/message/send-group - group_id: ${group_id}`);
  if (!group_id || !message) {
    logger.warn('Missing group_id or message in request body');
    return res.status(400).json({ error: 'Missing group_id or message' });
  }
  try {
    const result = await sendMessageToGroup(group_id, message);
    if (result.success) {
      logger.info(`Message sent successfully to group_id: ${group_id}`);
      return res.json({ success: true, message_id: result.messageId });
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