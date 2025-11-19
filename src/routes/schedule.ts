import express from 'express';
import ScheduledMessage from '../model/scheduledMessage';
const router = express.Router();

// Create a scheduled message
router.post('/', async (req, res) => {
  const { contactId, message, scheduledTime, creatorUserId } = req.body;
  if (!contactId || !message || !scheduledTime || !creatorUserId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const scheduledMsg = await ScheduledMessage.create({
      contactId,
      message,
      scheduledTime,
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
