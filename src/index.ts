import express from 'express';
import { connectToWhatsApp } from "./config/baileys-config";
import { sequelize } from "./config/sequelize-config";
import "./scheduler/schedulerService";
import logger from './logger';

(async () => {
  try {
    await sequelize.authenticate();
    logger.info('#main-process - DB connection established');
    // Ensure DB schema is created. DB_AUTO_ALTER=true asks Sequelize to ALTER
    // existing tables to match the models (use only in dev / on first deploy
    // after a schema change; never leave on in steady-state production).
    await sequelize.sync({
      alter: process.env.DB_AUTO_ALTER === 'true',
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
app.use(express.json({ limit: '25mb' }));

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
import chatRoutes from './routes/chat';
app.use('/api/chat', chatRoutes);
import privacyRoutes from './routes/privacy';
app.use('/api/privacy', privacyRoutes);

// Swagger UI + raw spec
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

app.listen(PORT, () => {
  logger.info(`#main-process - Server is running on port ${PORT}`);
  logger.info(`#main-process - Swagger UI:   http://localhost:${PORT}/api-docs`);
  logger.info(`#main-process - OpenAPI spec: http://localhost:${PORT}/api-docs.json`);
});
