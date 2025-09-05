import { connectToWhatsApp } from "./config/baileys-config";
import { sequelize } from "./config/sequelize-config";

connectToWhatsApp();

try {
  sequelize.authenticate();
  console.log('#main-process - Connection has been established successfully.');
} catch (error) {
  console.error('#main-process - Unable to connect to the database:', error);
}