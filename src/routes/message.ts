import express from 'express';
import { sendMessageToContact } from '../messageService';
import logger from '../logger';
const router = express.Router();

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

export default router;