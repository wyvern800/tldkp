export class Logger {
  constructor(interaction) {
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
    console.log(`[${this.guildName ? `${this.guildName}/` : ''}${prefix}] ${message}`);
  }

  /**
   * Logs an error message in a prettier way
   * 
   * @param {string} prefix Prefix of the logging message
   * @param {string} message The log message
   */
  error(prefix, errorMessage) {
    console.log(`[${this.guildName ? `${this.guildName}/` : ''}${prefix}] ${errorMessage}`);
  }
}
