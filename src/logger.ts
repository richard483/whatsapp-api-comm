import winston from 'winston';

const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;

  // If there are additional metadata fields, add them
  const metaKeys = Object.keys(metadata);
  if (metaKeys.length > 0) {
    // Filter out Symbol keys and format the metadata
    const cleanMeta = Object.keys(metadata)
      .filter(key => typeof key === 'string')
      .reduce((obj: any, key) => {
        obj[key] = metadata[key];
        return obj;
      }, {});

    if (Object.keys(cleanMeta).length > 0) {
      msg += ` - ${JSON.stringify(cleanMeta)}`;
    }
  }

  return msg;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;