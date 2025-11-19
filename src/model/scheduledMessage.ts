import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/sequelize-config';
import { Contacts } from './contact';

export interface ScheduledMessageAttributes {
  id: number;
  contactId: string;
  message: string;
  scheduledTime: Date;
  status: 'pending' | 'queued' | 'retrying' | 'sent' | 'failed' | 'cancelled';
  creatorUserId: string;
  errorLog?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScheduledMessageCreationAttributes extends Optional<ScheduledMessageAttributes, 'id' | 'errorLog' | 'createdAt' | 'updatedAt'> { }

class ScheduledMessage extends Model<ScheduledMessageAttributes, ScheduledMessageCreationAttributes>
  implements ScheduledMessageAttributes {
  public id!: number;
  public contactId!: string;
  public message!: string;
  public scheduledTime!: Date;
  public status!: 'pending' | 'queued' | 'retrying' | 'sent' | 'failed' | 'cancelled';
  public creatorUserId!: string;
  public errorLog?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ScheduledMessage.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Contacts,
        key: 'id',
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    scheduledTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'queued', 'retrying', 'sent', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    creatorUserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    errorLog: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'scheduled_messages',
    modelName: 'ScheduledMessage',
  }
);

ScheduledMessage.belongsTo(Contacts, { foreignKey: 'contactId', as: 'contact' });

export default ScheduledMessage;
