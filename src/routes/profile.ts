/**
 * @openapi
 * /api/profile:
 *   get:
 *     tags: [profile]
 *     summary: Get the bot's own WhatsApp identity (jid, lid, pushName, picture, status)
 *     responses: { 200: { description: OK }, 503: { description: Not connected } }
 *   patch:
 *     tags: [profile]
 *     summary: Update bot profile fields
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               status: { type: string }
 *               pictureUrl: { type: string, nullable: true, description: "URL to set, null to remove, omit to skip" }
 *     responses: { 200: { description: OK } }
 * /api/status:
 *   get:
 *     tags: [profile]
 *     summary: Current Baileys connection state (incl. last QR if pairing)
 *     responses: { 200: { description: OK } }
 */
import express from 'express';
import { getWaSocket, getConnectionStatus } from '../config/baileys-config';
import logger from '../logger';

const router = express.Router();

// GET /api/profile - own WhatsApp identity (name, jid, status, picture)
router.get('/profile', async (_req, res) => {
  try {
    const sock = getWaSocket();
    const user = sock?.user || null;
    if (!user) return res.status(503).json({ error: 'WhatsApp not connected' });

    const [pictureUrl, statusInfo] = await Promise.all([
      sock.profilePictureUrl(user.id, 'image').catch(() => null),
      sock.fetchStatus(user.id).catch(() => null),
    ]);

    return res.json({
      jid: user.id,
      lid: (user as any).lid || null,
      pushName: user.name || null,
      platform: (user as any).platform || null,
      pictureUrl: pictureUrl || null,
      status: (statusInfo?.[0] as any)?.status?.status || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// PATCH /api/profile - update own profile
// Body: { name?: string, status?: string, pictureUrl?: string | null }
//   pictureUrl: pass a URL string to set, null to remove, undefined to skip.
router.patch('/profile', async (req, res) => {
  try {
    const sock = getWaSocket();
    if (!sock?.user) return res.status(503).json({ error: 'WhatsApp not connected' });

    const { name, status, pictureUrl } = req.body || {};
    const applied: string[] = [];

    if (typeof name === 'string' && name.trim()) {
      await sock.updateProfileName(name.trim());
      applied.push('name');
    }
    if (typeof status === 'string') {
      await sock.updateProfileStatus(status);
      applied.push('status');
    }
    if (pictureUrl === null) {
      await (sock as any).removeProfilePicture(sock.user.id);
      applied.push('pictureUrl:removed');
    } else if (typeof pictureUrl === 'string' && pictureUrl) {
      await sock.updateProfilePicture(sock.user.id, { url: pictureUrl });
      applied.push('pictureUrl');
    }

    if (applied.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided (name, status, pictureUrl)' });
    }
    return res.json({ success: true, applied });
  } catch (err: any) {
    logger.error(`PATCH /api/profile - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/status - connection status
router.get('/status', (_req, res) => {
  return res.json(getConnectionStatus());
});

export default router;
