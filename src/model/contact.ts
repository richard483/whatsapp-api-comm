import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/sequelize-config";

interface ContactAttributes {
  id: string;
  whatsapp_jid: string;
  phone_number: string | null;
  display_name: string | null;
  description: string | null;
  is_business: boolean;
  additional_data: Record<string, any> | null;
  created_at?: Date;
  updated_at?: Date;
}

type ContactCreationAttributes = Optional<ContactAttributes, "id" | "phone_number" | "display_name" | "description" | "is_business" | "additional_data">;

export class Contacts extends Model<ContactAttributes, ContactCreationAttributes> implements ContactAttributes {
  declare id: string;
  declare whatsapp_jid: string;
  declare phone_number: string | null;
  declare display_name: string | null;
  declare description: string | null;
  declare is_business: boolean;
  declare additional_data: Record<string, any> | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

Contacts.init(
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
    phone_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_business: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    additional_data: {
      // JSONB for Postgres
      type: DataTypes.JSONB as any,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "contacts",
    tableName: "contacts",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["whatsapp_jid"] },
      { fields: ["phone_number"] },
    ],
  }
);
