/*
Logger class for easy and aesthetically pleasing console logging
*/
const chalk = require('chalk');
const moment = require('moment');

const LOG_TYPES = {
  log: chalk.bgBlue,
  warn: chalk.black.bgYellow,
  error: chalk.bgRed,
  debug: chalk.green,
  cmd: chalk.black.bgWhite,
  ready: chalk.black.bgGreen,
};

class Logger {
  static log(content, type = 'log') {
    const timestamp = `[${moment().format('YYYY-MM-DD HH:mm:ss')}]:`;

    if (!Object.keys(LOG_TYPES).includes(type)) {
      throw new TypeError(
        `Logger type must be one of: ${Object.keys(LOG_TYPES).join(', ')}`
      );
    }

    const color = LOG_TYPES[type];
    console.log(`${timestamp} ${color(type.toUpperCase())} ${content} `);
  }
}

for (const shortcut of ['error', 'warn', 'debug', 'cmd']) {
  Logger.prototype[shortcut] = function shortcutFn(content) {
    this.log(content, shortcut);
  };
}
