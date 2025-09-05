import dotenv from 'dotenv';

dotenv.config();

const {
  ENV,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} = process.env;


if (
  !ENV ||
  !DB_HOST ||
  !DB_USER ||
  !DB_PASSWORD ||
  !DB_NAME
) {
  throw new Error('Missing environment variables');
}

export const config = {
  ENV,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
};