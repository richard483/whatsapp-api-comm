/**
 * @openapi
 * /api/groups:
 *   get:
 *     tags: [groups]
 *     summary: List known groups (paginated)
 *     parameters:
 *       - { in: query, name: limit,  schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: offset, schema: { type: integer, default: 0 } }
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [groups]
 *     summary: Create a new group
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, participants]
 *             properties:
 *               subject: { type: string }
 *               participants: { type: array, items: { type: string }, description: "JIDs or bare phone numbers" }
 *     responses: { 200: { description: OK } }
 * /api/groups/join:
 *   post:
 *     tags: [groups]
 *     summary: Join a group via invite code or invite URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { code: { type: string }, url: { type: string, format: uri } }
 *     responses: { 200: { description: OK } }
 * /api/groups/{id}:
 *   get:
 *     tags: [groups]
 *     summary: Fetch a group; pass ?refresh=true to re-read live metadata
 *     parameters:
 *       - { in: path,  name: id,      required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: refresh, schema: { type: boolean } }
 *     responses: { 200: { description: OK }, 404: { description: Not found } }
 *   patch:
 *     tags: [groups]
 *     summary: Update group subject / description / settings
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject: { type: string }
 *               description: { type: string }
 *               announce: { type: boolean, description: "true = only admins can send" }
 *               locked: { type: boolean, description: "true = only admins can edit info" }
 *     responses: { 200: { description: OK } }
 * /api/groups/{id}/leave:
 *   post:
 *     tags: [groups]
 *     summary: Leave the group
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 * /api/groups/{id}/participants:
 *   post:
 *     tags: [groups]
 *     summary: Add / remove / promote / demote participants
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, participants]
 *             properties:
 *               action: { type: string, enum: [add, remove, promote, demote] }
 *               participants: { type: array, items: { type: string } }
 *     responses: { 200: { description: OK } }
 * /api/groups/{id}/invite-code:
 *   get:
 *     tags: [groups]
 *     summary: Get the current invite code + URL
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 * /api/groups/{id}/invite-code/revoke:
 *   post:
 *     tags: [groups]
 *     summary: Revoke the current invite code and return a new one
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 * /api/groups/{id}/join-requests:
 *   get:
 *     tags: [groups]
 *     summary: List pending join requests (groups with join-approval mode)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [groups]
 *     summary: Approve or reject pending join requests
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, participants]
 *             properties:
 *               action: { type: string, enum: [approve, reject] }
 *               participants: { type: array, items: { type: string } }
 *     responses: { 200: { description: OK } }
 */
import express from 'express';
import { Groups } from '../model/group';
import { getWaSocket } from '../config/baileys-config';
import logger from '../logger';

const router = express.Router();

async function resolveGroupJid(idOrJid: string): Promise<string | null> {
  if (idOrJid.endsWith('@g.us')) return idOrJid;
  const group = await Groups.findByPk(idOrJid);
  return group?.whatsapp_jid || null;
}

async function upsertGroupFromMeta(meta: any) {
  await Groups.upsert({
    whatsapp_jid: meta.id,
    subject: meta.subject || null,
    description: meta.desc || null,
    owner_jid: meta.owner || null,
    participant_count: (meta.size ?? (Array.isArray(meta.participants) ? meta.participants.length : null)) || null,
    additional_data: {
      restrict: meta.restrict ?? null,
      announce: meta.announce ?? null,
      participants: meta.participants ?? null,
      fetched_at: new Date().toISOString(),
    },
  });
}

// GET /api/groups
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 200);
    const offset = parseInt((req.query.offset as string) || '0', 10) || 0;
    const { rows, count } = await Groups.findAndCountAll({
      order: [['subject', 'ASC']],
      limit,
      offset,
    });
    return res.json({ items: rows, total: count, limit, offset });
  } catch (err: any) {
    logger.error(`GET /api/groups - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/groups - create a new group
// Body: { subject: string, participants: string[] (JIDs or phone numbers) }
router.post('/', async (req, res) => {
  try {
    const sock = getWaSocket();
    const { subject, participants } = req.body || {};
    if (!subject || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'subject and non-empty participants array required' });
    }
    const jids = participants.map((p: string) => p.includes('@') ? p : `${p}@s.whatsapp.net`);
    const meta = await sock.groupCreate(subject, jids);
    await upsertGroupFromMeta(meta);
    const created = await Groups.findOne({ where: { whatsapp_jid: meta.id } });
    return res.json(created);
  } catch (err: any) {
    logger.error(`POST /api/groups - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/groups/join - join via invite code or invite link
// Body: { code?: string, url?: string }
router.post('/join', async (req, res) => {
  try {
    const sock = getWaSocket();
    let { code, url } = req.body || {};
    if (!code && url) {
      const m = String(url).match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
      if (m) code = m[1];
    }
    if (!code) return res.status(400).json({ error: 'code or invite url required' });
    const groupId = await sock.groupAcceptInvite(code);
    if (!groupId) return res.status(400).json({ error: 'Failed to join group' });

    const meta = await sock.groupMetadata(groupId).catch(() => null);
    if (meta) await upsertGroupFromMeta(meta);
    return res.json({ success: true, jid: groupId });
  } catch (err: any) {
    logger.error(`POST /api/groups/join - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/groups/:id?refresh=true
router.get('/:id', async (req, res) => {
  try {
    const group = await Groups.findByPk(req.params.id);
    if (!group) return res.status(404).json({ error: 'Not found' });

    if (req.query.refresh === 'true') {
      try {
        const sock = getWaSocket();
        const meta: any = await sock.groupMetadata(group.whatsapp_jid);
        await upsertGroupFromMeta(meta);
        await group.reload();
      } catch (err: any) {
        logger.warn(`GET /api/groups/:id refresh failed - ${err?.message}`);
      }
    }
    return res.json(group);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// PATCH /api/groups/:id - update subject / description / setting
// Body: { subject?: string, description?: string, announce?: boolean, locked?: boolean }
router.patch('/:id', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveGroupJid(req.params.id);
    if (!jid) return res.status(404).json({ error: 'Group not found' });

    const { subject, description, announce, locked } = req.body || {};
    const applied: string[] = [];

    if (typeof subject === 'string' && subject) {
      await sock.groupUpdateSubject(jid, subject);
      applied.push('subject');
    }
    if (typeof description === 'string') {
      await sock.groupUpdateDescription(jid, description);
      applied.push('description');
    }
    if (typeof announce === 'boolean') {
      await sock.groupSettingUpdate(jid, announce ? 'announcement' : 'not_announcement');
      applied.push('announce');
    }
    if (typeof locked === 'boolean') {
      await sock.groupSettingUpdate(jid, locked ? 'locked' : 'unlocked');
      applied.push('locked');
    }

    if (applied.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided (subject, description, announce, locked)' });
    }
    return res.json({ success: true, applied });
  } catch (err: any) {
    logger.error(`PATCH /api/groups/:id - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/groups/:id/leave
router.post('/:id/leave', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveGroupJid(req.params.id);
    if (!jid) return res.status(404).json({ error: 'Group not found' });
    await sock.groupLeave(jid);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/groups/:id/participants
// Body: { action: 'add'|'remove'|'promote'|'demote', participants: string[] }
router.post('/:id/participants', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveGroupJid(req.params.id);
    if (!jid) return res.status(404).json({ error: 'Group not found' });

    const { action, participants } = req.body || {};
    if (!['add', 'remove', 'promote', 'demote'].includes(action)) {
      return res.status(400).json({ error: 'action must be add|remove|promote|demote' });
    }
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'participants array required' });
    }
    const jids = participants.map((p: string) => p.includes('@') ? p : `${p}@s.whatsapp.net`);
    const result = await sock.groupParticipantsUpdate(jid, jids, action);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/groups/:id/invite-code
router.get('/:id/invite-code', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveGroupJid(req.params.id);
    if (!jid) return res.status(404).json({ error: 'Group not found' });
    const code = await sock.groupInviteCode(jid);
    return res.json({ code: code || null, url: code ? `https://chat.whatsapp.com/${code}` : null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/groups/:id/invite-code/revoke
router.post('/:id/invite-code/revoke', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveGroupJid(req.params.id);
    if (!jid) return res.status(404).json({ error: 'Group not found' });
    const code = await sock.groupRevokeInvite(jid);
    return res.json({ code: code || null, url: code ? `https://chat.whatsapp.com/${code}` : null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/groups/:id/join-requests - list pending requests to join the group
router.get('/:id/join-requests', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveGroupJid(req.params.id);
    if (!jid) return res.status(404).json({ error: 'Group not found' });
    const list = await (sock as any).groupRequestParticipantsList(jid);
    return res.json({ items: list || [] });
  } catch (err: any) {
    logger.error(`GET /api/groups/:id/join-requests - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/groups/:id/join-requests - Body: { action: 'approve'|'reject', participants: string[] }
router.post('/:id/join-requests', async (req, res) => {
  try {
    const sock = getWaSocket();
    const jid = await resolveGroupJid(req.params.id);
    if (!jid) return res.status(404).json({ error: 'Group not found' });
    const { action, participants } = req.body || {};
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve|reject' });
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'participants array required' });
    }
    const jids = participants.map((p: string) => (p.includes('@') ? p : `${p}@s.whatsapp.net`));
    const result = await (sock as any).groupRequestParticipantsUpdate(jid, jids, action);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;
