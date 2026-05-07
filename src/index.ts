import express from 'express';
import { connectToWhatsApp } from "./config/baileys-config";
import { sequelize } from "./config/sequelize-config";
import "./scheduler/schedulerService";
import logger from './logger';

(async () => {
  try {
    await sequelize.authenticate();
    logger.info('#main-process - DB connection established');
    // Ensure DB schema is created
    await sequelize.sync({
      alter: false,
      force: false,
    });
    logger.info('#main-process - DB synced');
  } catch (error: any) {
    logger.error('#main-process - Unable to connect/sync database', { error: error.message, stack: error.stack });
  }

  // start WhatsApp connection after DB is ready
  await connectToWhatsApp();
})();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
import messageRoutes from './routes/message';
app.use('/api/message', messageRoutes);
import scheduleRoutes from './routes/schedule';
app.use('/api/schedule', scheduleRoutes);
import contactRoutes from './routes/contact';
app.use('/api/contacts', contactRoutes);
import groupRoutes from './routes/group';
app.use('/api/groups', groupRoutes);
import profileRoutes from './routes/profile';
app.use('/api', profileRoutes);

app.listen(PORT, () => {
  logger.info(`#main-process - Server is running on port ${PORT}`);
});