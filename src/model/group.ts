import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/sequelize-config";

interface GroupAttributes {
  id: string;
  whatsapp_jid: string;
  subject: string | null;
  description: string | null;
  owner_jid: string | null;
  participant_count: number | null;
  additional_data: Record<string, any> | null;
  created_at?: Date;
  updated_at?: Date;
}

type GroupCreationAttributes = Optional<GroupAttributes, "id" | "subject" | "description" | "owner_jid" | "participant_count" | "additional_data">;

export class Groups extends Model<GroupAttributes, GroupCreationAttributes> implements GroupAttributes {
  declare id: string;
  declare whatsapp_jid: string;
  declare subject: string | null;
  declare description: string | null;
  declare owner_jid: string | null;
  declare participant_count: number | null;
  declare additional_data: Record<string, any> | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Groups.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    whatsapp_jid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    owner_jid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    participant_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    additional_data: {
      type: DataTypes.JSONB as any,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "groups",
    tableName: "groups",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["whatsapp_jid"] },
    ],
  }
);
