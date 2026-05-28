/**
 * @openapi
 * /api/chat/{target}/presence:
 *   post:
 *     tags: [chat]
 *     summary: Send a presence update for a chat
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string }, description: "contact_id, group_id, or full JID" }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [presence]
 *             properties:
 *               presence: { type: string, enum: [available, unavailable, composing, recording, paused] }
 *     responses: { 200: { description: OK } }
 * /api/chat/{target}/subscribe-presence:
 *   post:
 *     tags: [chat]
 *     summary: Subscribe to presence updates for the target
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 * /api/chat/{target}/typing:
 *   post:
 *     tags: [chat]
 *     summary: Convenience start/stop typing
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { state: { type: string, enum: [start, stop] } } } } }
 *     responses: { 200: { description: OK } }
 * /api/chat/{target}/archive:
 *   post:
 *     tags: [chat]
 *     summary: Archive or unarchive the chat
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [archived], properties: { archived: { type: boolean } } } } }
 *     responses: { 200: { description: OK } }
 * /api/chat/{target}/pin:
 *   post:
 *     tags: [chat]
 *     summary: Pin or unpin the chat
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [pinned], properties: { pinned: { type: boolean } } } } }
 *     responses: { 200: { description: OK } }
 * /api/chat/{target}/mute:
 *   post:
 *     tags: [chat]
 *     summary: Mute the chat (duration in ms) or unmute (null)
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, properties: { duration_ms: { type: integer, nullable: true } } } } }
 *     responses: { 200: { description: OK } }
 * /api/chat/{target}/mark-unread:
 *   post:
 *     tags: [chat]
 *     summary: Mark the chat as unread
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 * /api/chat/{target}/read-all:
 *   post:
 *     tags: [chat]
 *     summary: Mark every stored inbound message in the chat as read
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK, content: { application/json: { schema: { type: object, properties: { success: { type: boolean }, marked: { type: integer } } } } } } }
 * /api/chat/{target}/disappearing:
 *   post:
 *     tags: [chat]
 *     summary: Toggle disappearing messages for the chat (0 disables)
 *     parameters: [{ in: path, name: target, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [duration_seconds], properties: { duration_seconds: { type: integer } } } } }
 *     responses: { 200: { description: OK } }
 */
import express from 'express';
import { getWaSocket } from '../config/baileys-config';
import { Messages } from '../model/message';
import { Contacts } from '../model/contact';
import { Groups } from '../model/group';
import logger from '../logger';

const router = express.Router();

// Resolve a path token (:target) that may be a contact UUID, group UUID, or full JID.
async function resolveJid(target: string): Promise<string | null> {
  if (!target) return null;
  if (target.endsWith('@s.whatsapp.net') || target.endsWith('@g.us') || target.endsWith('@lid')) return target;
  const c = await Contacts.findByPk(target).catch(() => null);
  if (c?.whatsapp_jid) return c.whatsapp_jid;
  const g = await Groups.findByPk(target).catch(() => null);
  if (g?.whatsapp_jid) return g.whatsapp_jid;
  return null;
}

// Look up the most recent stored message key for a chat — needed by chatModify
// for archive / markUnread / mute / delete operations.
async function getLastKeyForJid(jid: string) {
  const row = await Messages.findOne({ where: { remote_jid: jid }, order: [['timestamp', 'DESC']] });
  if (!row) return null;
  return {
    remoteJid: row.remote_jid,
    fromMe: row.from_me,
    id: row.whatsapp_message_id,
    participant: row.participant_jid || undefined,
    messageTimestamp: row.timestamp,
  };
}

// POST /api/chat/:target/presence
// Body: { presence: 'available'|'unavailable'|'composing'|'recording'|'paused' }
router.post('/:target/presence', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    const { presence } = req.body || {};
    const allowed = ['available', 'unavailable', 'composing', 'recording', 'paused'];
    if (!allowed.includes(presence)) {
      return res.status(400).json({ error: `presence must be one of ${allowed.join('|')}` });
    }
    await sock.sendPresenceUpdate(presence as any, jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/subscribe-presence - subscribe to presence updates for that JID
router.post('/:target/subscribe-presence', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    await sock.presenceSubscribe(jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/typing - convenience: start/stop typing
// Body: { state: 'start'|'stop' }
router.post('/:target/typing', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    const { state } = req.body || {};
    const presence = state === 'stop' ? 'paused' : 'composing';
    await sock.sendPresenceUpdate(presence as any, jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/archive - Body: { archived: boolean }
router.post('/:target/archive', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    const last = await getLastKeyForJid(jid);
    if (!last) return res.status(409).json({ error: 'No stored messages for this chat to anchor the modification' });
    await sock.chatModify({ archive: !!req.body?.archived, lastMessages: [last as any] }, jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/pin - Body: { pinned: boolean }
router.post('/:target/pin', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    await sock.chatModify({ pin: !!req.body?.pinned } as any, jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/mute - Body: { duration_ms: number | null }   (null to unmute)
router.post('/:target/mute', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    const duration = req.body?.duration_ms;
    const value = duration === null || duration === undefined ? null : Number(duration);
    await sock.chatModify({ mute: value } as any, jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/mark-unread
router.post('/:target/mark-unread', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    const last = await getLastKeyForJid(jid);
    if (!last) return res.status(409).json({ error: 'No stored messages for this chat to anchor the modification' });
    await sock.chatModify({ markRead: false, lastMessages: [last as any] }, jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/read-all - mark every unread inbound message in the chat as read
router.post('/:target/read-all', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    const rows = await Messages.findAll({
      where: { remote_jid: jid, from_me: false },
      order: [['timestamp', 'DESC']],
      limit: 500,
    });
    const keys = rows.map((r) => ({
      remoteJid: r.remote_jid,
      fromMe: false,
      id: r.whatsapp_message_id,
      participant: r.participant_jid || undefined,
    }));
    if (keys.length > 0) await sock.readMessages(keys);
    return res.json({ success: true, marked: keys.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/chat/:target/disappearing - Body: { duration_seconds: number }   (0 disables)
router.post('/:target/disappearing', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveJid(req.params.target);
    if (!jid) return res.status(404).json({ error: 'Target not found' });
    const duration = Number(req.body?.duration_seconds);
    if (!Number.isFinite(duration) || duration < 0) {
      return res.status(400).json({ error: 'duration_seconds (number >= 0) required' });
    }
    await sock.sendMessage(jid, { disappearingMessagesInChat: duration } as any);
    return res.json({ success: true, duration_seconds: duration });
  } catch (err: any) {
    logger.error(`POST /api/chat/:target/disappearing - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;
