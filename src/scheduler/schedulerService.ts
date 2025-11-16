import cron from 'node-cron';
import ScheduledMessage from '../model/scheduledMessage';
import { sendMessageToContact } from '../messageService';
import logger from '../logger';

// Runs every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Find messages that are pending/queued and scheduledTime <= now
    const messages = await ScheduledMessage.findAll({
      where: {
        status: ['pending', 'queued'],
        scheduledTime: { lte: now },
      },
    });
    for (const msg of messages) {
      try {
        // Update status to 'retrying' before sending
        await msg.update({ status: 'retrying' });
        const result = await sendMessageToContact(String(msg.contactId), msg.message);
        if (result.success) {
          await msg.update({ status: 'sent', errorLog: null });
          logger.info(`Scheduled message sent: id=${msg.id} contactId=${msg.contactId}`);
        } else {
          await msg.update({ status: 'failed', errorLog: result.error || JSON.stringify(result.details) });
          logger.error(`Failed to send scheduled message id=${msg.id}: ${result.error}`);
        }
      } catch (err: any) {
        await msg.update({ status: 'failed', errorLog: err?.message || JSON.stringify(err) });
        logger.error(`Error sending scheduled message id=${msg.id}: ${err?.message || err}`);
      }
    }
  } catch (err) {
    logger.error('Scheduler error:', err);
  }
});
