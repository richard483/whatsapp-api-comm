import express from 'express';
import { Op } from 'sequelize';
import { Contacts } from '../model/contact';
import { getWaSocket } from '../config/baileys-config';
import logger from '../logger';

const router = express.Router();

function normalizePhone(input: string): string {
  return String(input).replace(/[^\d]/g, '');
}

// GET /api/contacts?limit=&offset=&q=
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 200);
    const offset = parseInt((req.query.offset as string) || '0', 10) || 0;
    const q = (req.query.q as string | undefined)?.trim();

    const where: Record<string, any> = {};
    if (q) {
      where[Op.or as any] = [
        { display_name: { [Op.iLike]: `%${q}%` } },
        { phone_number: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const { rows, count } = await Contacts.findAndCountAll({
      where,
      order: [['display_name', 'ASC'], ['phone_number', 'ASC']],
      limit,
      offset,
    });
    return res.json({ items: rows, total: count, limit, offset });
  } catch (err: any) {
    logger.error(`GET /api/contacts - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/contacts/check?phone_number=
// Verify a number is on WhatsApp without persisting.
router.get('/check', async (req, res) => {
  try {
    const sock = getWaSocket();
    const phone = (req.query.phone_number as string) || '';
    if (!phone) return res.status(400).json({ error: 'phone_number required' });
    const result = await sock.onWhatsApp(normalizePhone(phone));
    const entry = result?.[0];
    return res.json({
      exists: !!entry?.exists,
      jid: entry?.jid || null,
      lid: (entry as any)?.lid || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// POST /api/contacts - add a contact (verifies via onWhatsApp first)
// Body: { phone_number: string, display_name?: string }
router.post('/', async (req, res) => {
  try {
    const sock = getWaSocket();
    const { phone_number, display_name } = req.body || {};
    if (!phone_number) return res.status(400).json({ error: 'phone_number required' });

    const phone = normalizePhone(phone_number);
    const result = await sock.onWhatsApp(phone);
    const entry = result?.[0];
    if (!entry?.exists || !entry.jid) {
      return res.status(404).json({ error: 'Phone number is not on WhatsApp', phone });
    }

    const [contact, created] = await Contacts.findOrCreate({
      where: { whatsapp_jid: entry.jid },
      defaults: {
        whatsapp_jid: entry.jid,
        phone_number: phone,
        display_name: display_name || null,
        description: null,
        is_business: false,
        additional_data: { lid: (entry as any).lid || null },
      },
    });

    if (!created && display_name && contact.display_name !== display_name) {
      await contact.update({ display_name });
    }
    return res.status(created ? 201 : 200).json(contact);
  } catch (err: any) {
    logger.error(`POST /api/contacts - ${err?.message}`);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await Contacts.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// PATCH /api/contacts/:id - update local-only fields
// Body: { display_name?: string, description?: string }
router.patch('/:id', async (req, res) => {
  try {
    const row = await Contacts.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const { display_name, description } = req.body || {};
    const updates: Record<string, any> = {};
    if (typeof display_name === 'string') updates.display_name = display_name;
    if (typeof description === 'string') updates.description = description;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }
    await row.update(updates);
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// DELETE /api/contacts/:id - removes from local DB only (WhatsApp has no server-side contact list)
router.delete('/:id', async (req, res) => {
  try {
    const row = await Contacts.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    await row.destroy();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

export default router;
