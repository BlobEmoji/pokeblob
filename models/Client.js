
const Discord = require('discord.js');
const klaw = require('klaw');

const Context = require('./Context.js');
const Director = require('./database/Director.js');


class Client extends Discord.Client {
  constructor(options) {
    super(options);

    this.db = new Director(options.db);
    this.commands = new Discord.Collection();
    this.lookup = new Discord.Collection();
    this.prefixes = options.prefixes ? options.prefixes : ['-'];

    this.on('message', this.processCommands);
  }

  get commandRegex() {
    // escape the prefixes so they're 'regex-safe'
    const escapedPrefixes = this.prefixes.map(x => x.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
    // return the regex that captures commands
    return new RegExp(`^(${escapedPrefixes})([a-zA-Z](?:[a-zA-Z0-9]+)?) *(?: (.+))?$`);
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
      if (await command.check(context))
        await command.run(context);
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

    if (command.meta.aliases)
      for (const alias of command.meta.aliases)
        this.lookup.set(alias, command);
  }

  async loadCommandByPath(path) {
    await this.loadCommandObject(require(path));
  }

  findLoadCommands() {
    klaw('./commands').on('data', filepath => {
      if (filepath.path.slice(-11) === '/command.js')
        this.loadCommandByPath(filepath.path);
    });
  }

  async destroy() {
    await super.destroy();
    await this.db.release();
  }
}

module.exports = Client;
