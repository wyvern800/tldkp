import Rollbar from 'rollbar';
import { config } from 'dotenv';

config();

export class Logger {
  static rollbar = null;

  constructor(interaction) {
    if (Logger.rollbar === null) {
      console.log(`[Rollbar] Initializing now...`);
      Logger.rollbar = new Rollbar({
        accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
        captureUncaught: true,
        captureUnhandledRejections: true,
      });
    }

    if (interaction) {
      this.guildName = interaction?.guild?.name;
    }
  }
  
  /**
   * Logs a message in a prettier way
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  log(prefix, message) {
    const msg = `[${this.guildName ? `${this.guildName}/` : ''}${prefix}] ${message}`;
    console.log(msg);
    Logger.rollbar.log(msg);
  }

  /**
   * Logs a message in a prettier way (without logging to Rollbar)
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  logLocal(prefix, message) {
    const msg = `[${this.guildName ? `${this.guildName}/` : ''}${prefix}] ${message}`;
    console.log(msg);
  }

  /**
   * Logs an error message in a prettier way
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  error(prefix, errorMessage) {
    const messageError = `[${this.guildName ? `${this.guildName}/` : ''}${prefix}] ${errorMessage}`;
    console.log(messageError);
    Logger.rollbar.error(messageError);
  }

  /**
   * Logs an error message in a prettier way
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  criticalError(prefix, errorMessage) {
    const messageCritical = `[${this.guildName ? `${this.guildName}/` : ''}${prefix}] ${errorMessage}`;
    console.log(messageCritical);
    Logger.rollbar.critical(messageCritical);
  }
}
