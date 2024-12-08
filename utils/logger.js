import Rollbar from 'rollbar';
import { config } from 'dotenv';
import winston from "winston";
import { format } from 'date-fns';

config();

export class Logger {
  static rollbar = null;
  static winstonLogger = null;

  constructor(interaction) {
    if (Logger.winstonLogger === null) {
      Logger.winstonLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.colorize(), // Add colorize format
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message }) => {
            return `[${level}] [${format(timestamp, "hh:mm:ss | dd/MM/yyyy")}] ${message}`;
          })
        ),
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ filename: 'combined.log' })
        ]
      });
      Logger.winstonLogger.info(`[Logger] Initializing Winston...`);
    }

    if (Logger.rollbar === null) {
      Logger.rollbar = new Rollbar({
        accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
        captureUncaught: true,
        captureUnhandledRejections: true,
      });
      Logger.winstonLogger.info(`[Logger] Initializing Rollbar...`);
    }

    if (interaction) {
      this.guildName = interaction?.guild?.name;
      this.guildId = interaction?.guild.id;
    }
  }
  
  /**
   * Logs a message in a prettier way
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  log(prefix, message) {
    const msg = `[${this.guildId ? `${this.guildId}/${this.guildName}(${this.guildId})/` : ''}${prefix}] ${message}`;
    Logger.winstonLogger.info(msg);
  }

  /**
   * Logs a message in a prettier way (without logging to Rollbar)
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  logLocal(prefix, message) {
    const msg = `[${this.guildId ? `${this.guildId}/${this.guildName}(${this.guildId})/` : ''}${prefix}] ${message}`;
    Logger.winstonLogger.info(msg);
  }

  /**
   * Logs an error message in a prettier way
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  error(prefix, errorMessage) {
    const messageError = `[${this.guildId ? `${this.guildId}/${this.guildName}(${this.guildId})/` : ''}${prefix}] ${errorMessage}`;
    Logger.rollbar.error(messageError);
    Logger.winstonLogger.error(messageError);
  }

  /**
   * Logs an error message in a prettier way
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  criticalError(prefix, errorMessage) {
    const messageCritical = `[${this.guildId ? `${this.guildId}/${this.guildName}(${this.guildId})/` : ''}${prefix}] ${errorMessage}`;
    Logger.rollbar.critical(messageCritical);
    Logger.winstonLogger.error(messageCritical);
  }
}
