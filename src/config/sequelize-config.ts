import { Sequelize } from "sequelize";
import { config } from "../env";

export const sequelize = new Sequelize(`postgres://${config.DB_USER}:${config.DB_PASSWORD}@${config.DB_HOST}/${config.DB_NAME}`, {
  dialect: 'postgres',
  logging: false
});