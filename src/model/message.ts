import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/sequelize-config";
import { Contacts } from "./contact";
import { Groups } from "./group";

interface MessageAttributes {
  id: string;
  whatsapp_message_id: string;
  remote_jid: string;
  participant_jid: string | null;
  contact_id: string | null;
  sender_contact_id: string | null;
  group_id: string | null;
  timestamp: number; // epoch seconds
  message_type: string | null;
  message_text: string | null;
  push_name_snapshot: string | null;
  is_group: boolean;
  additional_data: Record<string, any> | null;
  created_at?: Date;
  updated_at?: Date;
}

type MessageCreationAttributes = Optional<MessageAttributes, "id" | "participant_jid" | "contact_id" | "sender_contact_id" | "group_id" | "message_type" | "message_text" | "push_name_snapshot" | "additional_data">;

export class Messages extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  declare id: string;
  declare whatsapp_message_id: string;
  declare remote_jid: string;
  declare participant_jid: string | null;
  declare contact_id: string | null;
  declare sender_contact_id: string | null;
  declare group_id: string | null;
  declare timestamp: number;
  declare message_type: string | null;
  declare message_text: string | null;
  declare push_name_snapshot: string | null;
  declare is_group: boolean;
  declare additional_data: Record<string, any> | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Messages.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    whatsapp_message_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    remote_jid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    participant_jid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Contacts, key: "id" },
      onDelete: "SET NULL",
    },
    sender_contact_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Contacts, key: "id" },
      onDelete: "SET NULL",
    },
    group_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Groups, key: "id" },
      onDelete: "SET NULL",
    },
    timestamp: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    message_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    message_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    push_name_snapshot: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_group: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    additional_data: {
      type: DataTypes.JSONB as any,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "messages",
    tableName: "messages",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["whatsapp_message_id"] },
      { fields: ["remote_jid"] },
      { fields: ["timestamp"] },
      { fields: ["contact_id"] },
      { fields: ["group_id"] },
    ],
  }
);

// Define associations (optional runtime usage)
Contacts.hasMany(Messages, { foreignKey: "contact_id" });
Contacts.hasMany(Messages, { foreignKey: "sender_contact_id" });
Groups.hasMany(Messages, { foreignKey: "group_id" });
Messages.belongsTo(Contacts, { foreignKey: "contact_id", as: "contact" });
Messages.belongsTo(Contacts, { foreignKey: "sender_contact_id", as: "sender_contact" });
Messages.belongsTo(Groups, { foreignKey: "group_id", as: "group" });
