/**
 * @openapi
 * /api/privacy/blocklist:
 *   get:
 *     tags: [privacy]
 *     summary: Fetch JIDs we have blocked
 *     responses: { 200: { description: OK, content: { application/json: { schema: { type: object, properties: { blocked: { type: array, items: { type: string } } } } } } } }
 *   post:
 *     tags: [privacy]
 *     summary: Block or unblock a contact / JID / phone number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, target]
 *             properties:
 *               action: { type: string, enum: [block, unblock] }
 *               target: { type: string, description: "JID, contact_id, or phone number" }
 *     responses: { 200: { description: OK } }
 * /api/privacy/settings:
 *   get:
 *     tags: [privacy]
 *     summary: Fetch current privacy settings
 *     responses: { 200: { description: OK } }
 *   patch:
 *     tags: [privacy]
 *     summary: Update one or more privacy settings
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               last:         { type: string, enum: [all, contacts, contact_blacklist, none] }
 *               online:       { type: string, enum: [all, match_last_seen] }
 *               profile:      { type: string, enum: [all, contacts, contact_blacklist, none] }
 *               status:       { type: string, enum: [all, contacts, contact_blacklist, none] }
 *               readreceipts: { type: string, enum: [all, none] }
 *               groupadd:     { type: string, enum: [all, contacts, contact_blacklist, none] }
 *     responses: { 200: { description: OK } }
 * /api/privacy/profile-picture:
 *   get:
 *     tags: [privacy]
 *     summary: Profile picture URL for an arbitrary JID / contact / phone number
 *     parameters:
 *       - { in: query, name: target, required: true, schema: { type: string } }
 *       - { in: query, name: high,   schema: { type: boolean, default: false } }
 *     responses: { 200: { description: OK } }
 */
import express from 'express';
import { getWaSocket } from '../config/baileys-config';
import { Contacts } from '../model/contact';
import logger from '../logger';

const router = express.Router();

async function resolveJid(input: string): Promise<string | null> {
  if (!input) return null;
  if (input.endsWith('@s.whatsapp.net') || input.endsWith('@g.us') || input.endsWith('@lid')) return input;
  const c = await Contacts.findByPk(input).catch(() => null);
  if (c?.whatsapp_jid) return c.whatsapp_jid;
  // bare phone number → JID
  const digits = String(input).replace(/[^\d]/g, '');
  if (digits) return `${digits}@s.whatsapp.net`;
  return null;
}

// GET /api/privacy/blocklist
router.get('/blocklist', async (_req, res) => {
  try {
    const sock = getWaSocket();
    const list = await sock.fetchBlocklist();
    return res.json({ blocked: list || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/privacy/blocklist - Body: { action: 'block'|'unblock', target: <jid|contact_id|phone> }
router.post('/blocklist', async (req, res) => {
  try {
    const sock = getWaSocket();
    const { action, target } = req.body || {};
    if (!['block', 'unblock'].includes(action)) return res.status(400).json({ error: 'action must be block|unblock' });
    const jid = await resolveJid(target);
    if (!jid) return res.status(400).json({ error: 'Could not resolve target to a JID' });
    await sock.updateBlockStatus(jid, action as any);
    return res.json({ success: true, jid });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/privacy/settings
router.get('/settings', async (_req, res) => {
  try {
    const sock = getWaSocket();
    const settings = await sock.fetchPrivacySettings(true);
    return res.json(settings);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// PATCH /api/privacy/settings - Body: { last?, online?, profile?, status?, readreceipts?, groupadd? }
// Allowed values per field follow Baileys (all, contacts, contact_blacklist, none, match_last_seen, etc.).
router.patch('/settings', async (req, res) => {
  try {
    const sock = getWaSocket();
    const { last, online, profile, status, readreceipts, groupadd } = req.body || {};
    const applied: string[] = [];
    if (last) { await sock.updateLastSeenPrivacy(last); applied.push('last'); }
    if (online) { await sock.updateOnlinePrivacy(online); applied.push('online'); }
    if (profile) { await sock.updateProfilePicturePrivacy(profile); applied.push('profile'); }
    if (status) { await sock.updateStatusPrivacy(status); applied.push('status'); }
    if (readreceipts) { await sock.updateReadReceiptsPrivacy(readreceipts); applied.push('readreceipts'); }
    if (groupadd) { await sock.updateGroupsAddPrivacy(groupadd); applied.push('groupadd'); }
    if (applied.length === 0) return res.status(400).json({ error: 'No updatable fields provided' });
    return res.json({ success: true, applied });
  } catch (err: any) {
    logger.error(`PATCH /api/privacy/settings - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/profile-picture?target=<jid|contact_id|phone>&high=true|false
router.get('/profile-picture', async (req, res) => {
  try {
    const sock = getWaSocket();
    const target = (req.query.target as string) || '';
    const high = (req.query.high as string) === 'true';
    const jid = await resolveJid(target);
    if (!jid) return res.status(400).json({ error: 'Could not resolve target to a JID' });
    const url = await sock.profilePictureUrl(jid, high ? 'image' : 'preview').catch(() => null);
    return res.json({ jid, url: url || null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;
