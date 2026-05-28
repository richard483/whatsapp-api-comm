/**
 * @openapi
 * /api/schedule:
 *   get:
 *     tags: [schedule]
 *     summary: List all scheduled messages
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [schedule]
 *     summary: Schedule an outbound message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contactId, message, scheduledDate, scheduledTime, timeZone, creatorUserId]
 *             properties:
 *               contactId: { type: string }
 *               message: { type: string }
 *               scheduledDate: { type: string, example: "2026-06-01" }
 *               scheduledTime: { type: string, example: "14:30" }
 *               timeZone: { type: string, example: "GMT+07" }
 *               creatorUserId: { type: string }
 *     responses: { 201: { description: Created } }
 * /api/schedule/{id}:
 *   get:
 *     tags: [schedule]
 *     summary: Get a scheduled message
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK }, 404: { description: Not found } }
 *   put:
 *     tags: [schedule]
 *     summary: Replace fields on a scheduled message
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 *   delete:
 *     tags: [schedule]
 *     summary: Delete a scheduled message
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 */
import express from 'express';
import ScheduledMessage from '../model/scheduledMessage';
const router = express.Router();

function parseTimezoneOffset(timeZone: string): number {
  const match = timeZone.match(/^GMT([+-])(\d{2})(?::?(\d{2}))?$/i);
  if (!match) {
    throw new Error(`Invalid timezone format: ${timeZone}. Expected format like "GMT+07" or "GMT-05:30"`);
  }
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes);
}

function parseScheduledDateTime(scheduledDate: string, scheduledTime: string, timeZone: string): Date {
  const offsetMinutes = parseTimezoneOffset(timeZone);

  const localDateTimeStr = `${scheduledDate}T${scheduledTime}:00`;

  const localDate = new Date(localDateTimeStr + 'Z');

  localDate.setMinutes(localDate.getMinutes() - offsetMinutes);

  return localDate;
}

router.post('/', async (req, res) => {
  const { contactId, message, scheduledDate, scheduledTime, timeZone, creatorUserId } = req.body;
  if (!contactId || !message || !scheduledDate || !scheduledTime || !timeZone || !creatorUserId) {
    return res.status(400).json({ error: 'Missing required fields: contactId, message, scheduledDate, scheduledTime, timeZone, creatorUserId' });
  }
  try {
    const scheduledDateTime = parseScheduledDateTime(scheduledDate, scheduledTime, timeZone);

    if (isNaN(scheduledDateTime.getTime())) {
      return res.status(400).json({ error: 'Invalid date/time format' });
    }

    const scheduledMsg = await ScheduledMessage.create({
      contactId,
      message,
      scheduledTime: scheduledDateTime,
      status: 'pending',
      creatorUserId,
    });
    return res.status(201).json(scheduledMsg);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create scheduled message' });
  }
});

// List all scheduled messages
router.get('/', async (req, res) => {
  try {
    const messages = await ScheduledMessage.findAll();
    return res.json(messages);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch scheduled messages' });
  }
});

// Get one scheduled message
router.get('/:id', async (req, res) => {
  try {
    const msg = await ScheduledMessage.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Scheduled message not found' });
    return res.json(msg);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch scheduled message' });
  }
});

// Update scheduled message
router.put('/:id', async (req, res) => {
  try {
    const msg = await ScheduledMessage.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Scheduled message not found' });
    await msg.update(req.body);
    return res.json(msg);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update scheduled message' });
  }
});

// Delete scheduled message
router.delete('/:id', async (req, res) => {
  try {
    const msg = await ScheduledMessage.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Scheduled message not found' });
    await msg.destroy();
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete scheduled message' });
  }
});

export default router;
