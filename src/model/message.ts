import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/sequelize-config";

export class Messages extends Model {
  declare id: number;
  declare timestamp: number;
  declare message: string;
  declare pushName: string;
  declare senderPn: string;
  declare isGroup: boolean;
}

Messages.init(
  {
    id: {
      type: DataTypes.UUIDV4,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    timestamp: {
      type: DataTypes.NUMBER,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    pushName: {
      type: DataTypes.STRING,
    },
    senderPn: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isGroup: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    groupId: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  },
  {
    sequelize,
    modelName: "messages",
    timestamps: false,
  },
);