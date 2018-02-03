
const Discord = require('discord.js');
const klaw = require('klaw');
const util = require('util');
const winston = require('winston');

const Context = require('./Context.js');
const Director = require('./database/Director.js');


class Client extends Discord.Client {
  constructor(options) {
    super(options);

    // always remove the token so we don't expose it accidentally
    this.config = Object.assign({}, options, { token: null });
    this.db = new Director(options.db);
    this.prefixes = options.prefixes ? options.prefixes : ['-'];

    this.commands = new Discord.Collection();
    this.lookup = new Discord.Collection();

    this.logger = winston.createLogger({
      levels: {
        error: 0,
        warn: 1,
        info: 2,
        verbose: 3,
        debug: 4,
        silly: 5
      },
      transports: [
        new winston.transports.Console({
          level: options.logging.console,
          format: winston.format.combine(
            winston.format.timestamp({
              format: 'ddd D HH:mm:ss'
            }),
            winston.format.colorize({
              colors: {
                error: 'red',
                warn: 'yellow',
                info: 'white',
                verbose: 'grey',
                debug: 'cyan',
                silly: 'magenta'
              }
            }),
            winston.format.printf((info) => `[${info.timestamp}] <${info.level}> ${info.message}`)
          )
        }),
        new winston.transports.File({
          filename: 'bot.log',
          level: options.logging.file,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf((info) => `[${info.timestamp}] <${info.level}> ${info.message}`)
          )
        })
      ]
    });

    this.logger.log('info', 'bot instance created; logger engaged');

    this.on('message', this.processCommands);
  }

  get commandRegex() {
    // escape the prefixes so they're 'regex-safe'
    const escapedPrefixes = this.prefixes.map(x => x.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
    // return the regex that captures commands
    return new RegExp(`^(${escapedPrefixes})([a-zA-Z](?:[a-zA-Z0-9]+)?) *(?: ([\\s\\S]+))?$`);
  }

  async processCommands(message) {
    const match = this.commandRegex.exec(message.content);
    if (!match)
      return;

    const command = this.lookup.get(match[2]);
    if (!command)
      return;
    
    const context = await (new Context(this, message, match[1], match[3])).prepare();

    try {
      if (await command.check(context)) {
        this.logger.log('verbose', `${message.author.id} issued command: ${command.meta.name}`);
        await command.run(context);
        this.logger.log('debug', `${message.author.id} finished running command: ${command.meta.name}`);
      } else {
        this.logger.log('debug', `${message.author.id} tried to run a command but failed the check: ${command.meta.name}`);
      }
    } catch (err) {
      this.logger.log('error', `an unexpected error occurred while ${message.author.id} was executing command: ${command.meta.name}\n` +
                               `(guild ${message.guild.id}, channel ${message.channel.id}, user ${message.author.id}, message ${message.id})\n` + 
                               `${util.inspect(err)}`);
    } finally {
      await context.destroy();
    }
  }

  async loadCommandObject(commandObject) {
    const command = new commandObject(this);

    if (!command.meta || !command.meta.name)
      throw new Error('command object has broken meta');

    if (this.commands.has(command.meta.name))
      throw new Error('command of name already registered');

    if (command.meta.aliases)
      if (command.meta.aliases.filter(x => this.lookup.has(x)).length !== 0)
        throw new Error('command registers alias that is already in use');
    
    // register the command
    this.commands.set(command.meta.name, command);
    this.lookup.set(command.meta.name, command);

    this.logger.log('info', `loaded command: ${command.meta.name}`);

    if (command.meta.aliases)
      for (const alias of command.meta.aliases) {
        this.lookup.set(alias, command);
        this.logger.log('verbose', `loaded alias: ${alias} => ${command.meta.name}`);
      }
  }

  async loadCommandByPath(path) {
    await this.loadCommandObject(require(path));
  }

  clean(text) {
    if (typeof text !== 'string')
      text = util.inspect(text, { depth: 1 });
    
    const zwsp = String.fromCharCode(8203);
    text = text.replace(/@|`/gi, x => `${x}${zwsp}`);

    return text;
  }

  findLoadCommands() {
    klaw('./commands').on('data', filepath => {
      if (filepath.path.slice(-11) === '/command.js') {
        this.logger.log('debug', `loading walked command from path: ${filepath.path}`);
        this.loadCommandByPath(filepath.path);
      }
    });
  }

  async destroy() {
    await super.destroy();
    await this.db.release();
  }
}

module.exports = Client;
