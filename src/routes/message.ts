import express from 'express';
import { sendMessageToContact } from '../messageService';
const router = express.Router();

// POST /api/message/send
router.post('/send', async (req, res) => {
  const { contact_id, message } = req.body;
  if (!contact_id || !message) {
    return res.status(400).json({ error: 'Missing contact_id or message' });
  }
  try {
    const result = await sendMessageToContact(contact_id, message);
    if (result.success) {
      return res.json({ success: true, message_id: result.messageId });
    } else {
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
    return res.status(500).json({
      error: err?.message || 'Unexpected error',
      type: err?.type || 'InternalError',
      contact_id,
      message,
      stack: err?.stack || undefined,
    });
  }
});

export default router;