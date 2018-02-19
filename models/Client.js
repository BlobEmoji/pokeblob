
const Discord = require('discord.js');
const fs = require('fs');
const klaw = require('klaw');
const lodash = require('lodash');
const MessageFormat = require('messageformat');
const path = require('path');
const util = require('util');
const winston = require('winston');
const yaml = require('js-yaml');

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

    this.locale = new Discord.Collection();

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
    // return the regex that captures commands
    return new RegExp(`^(${this.prefixRegex})([a-zA-Z](?:[a-zA-Z0-9]+)?) *(?: ([\\s\\S]+))?$`);
  }

  get prefixRegex() {
    // escape the prefixes so they're 'regex-safe'
    return this.prefixes.map(x => x.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
  }

  async processCommands(message) {
    const match = this.commandRegex.exec(message.content);
    if (!match)
      return;

    const command = this.lookup.get(match[2]);
    if (!command)
      return;

    if (!message.guild)
      return await message.channel.send('I don\'t work in DMs! Please find somewhere else to use commands.');

    if (!message.guild.available)
      // nah
      return;

    const context = await (new Context(this, message, match[1], match[3])).prepare();

    try {
      if (await command.check(context)) {
        this.logger.log('verbose', `${message.author.id} issued command: ${command.meta.name} [${context.uid}]`);
        await command.run(context);
        this.logger.log('debug', `${message.author.id} finished running command: ${command.meta.name} [${context.uid}]`);
      } else {
        this.logger.log('debug', `${message.author.id} tried to run a command but failed the check: ${command.meta.name} [${context.uid}]`);
      }
    } catch (err) {
      this.logger.log('error', `an unexpected error occurred while ${message.author.id} was executing command: ${command.meta.name}\n` +
                               `(uid ${context.uid}, guild ${message.guild.id}, channel ${message.channel.id}, user ${message.author.id}, message ${message.id})\n` +
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

  async loadCommandByPath(pathName) {
    await this.loadCommandObject(require(pathName));
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
      if (path.parse(filepath.path).base === 'command.js') {
        this.logger.log('debug', `loading walked command from path: ${filepath.path}`);
        this.loadCommandByPath(filepath.path);
      }
    });
  }

  localize(localeName, localeStrName, ...args) {
    const localeObj = this.locale.has(localeName) ? this.locale.get(localeName) : this.locale.get('en');
    const localeTransform = lodash.get(localeObj, localeStrName, false);
    return localeTransform ? localeTransform(...args).trim('\n') : localeStrName;
  }

  localizeIndex(localeName, localeStrName, index, ...args) {
    const localeObj = this.locale.has(localeName) ? this.locale.get(localeName) : this.locale.get('en');
    const localeList = lodash.get(localeObj, localeStrName, false);
    if (!localeList)
      return localeStrName;
    const localeTransform = localeList[index % Object.keys(localeList).length];
    return localeTransform ? localeTransform(...args).trim('\n') : localeStrName;
  }

  localizeRandom(localeName, localeStrName, ...args) {
    const localeObj = this.locale.has(localeName) ? this.locale.get(localeName) : this.locale.get('en');
    const localeList = lodash.get(localeObj, localeStrName, false);
    if (!localeList)
      return localeStrName;
    const localeTransform = localeList[Math.floor(Math.random() * Object.keys(localeList).length)];
    return localeTransform ? localeTransform(...args).trim('\n') : localeStrName;
  }

  findLoadLocales() {
    klaw('./locale').on('data', filepath => {
      const pathData = path.parse(filepath.path);
      if (pathData.ext === '.yml') {
        this.logger.log('debug', `loading walked locale: ${pathData.base}`);
        const client = this;  // can't access 'this' from anon
        fs.readFile(filepath.path, 'utf8', function(err, data) {
          if (err) throw err;
          client.locale.set(pathData.name, (new MessageFormat(pathData.name)).compile(yaml.safeLoad(data)));
        });
      }
    });
  }

  wait(...args) {
    return new Promise(r => setTimeout(r, ...args));
  }

  async destroy() {
    await super.destroy();
    await this.db.release();
  }
}

module.exports = Client;
