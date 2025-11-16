import { connectToWhatsApp } from "./config/baileys-config";
import { sequelize } from "./config/sequelize-config";
import "./scheduler/schedulerService";

(async () => {
  try {
    await sequelize.authenticate();
    console.log('#main-process - DB connection established.');
    // Ensure DB schema is created
    await sequelize.sync();
    console.log('#main-process - DB synced.');
  } catch (error) {
    console.error('#main-process - Unable to connect/sync database:', error);
  }

  // start WhatsApp connection after DB is ready
  await connectToWhatsApp();
})();