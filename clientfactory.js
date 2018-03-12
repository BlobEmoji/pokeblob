require('./extenders/Guild.js');
// Load up the discord.js library
const Discord = require('discord.js');
// We also load the rest of the things we need in this file:
const { promisify } = require('util');
const readdir = promisify(require('fs').readdir);
const Enmap = require('enmap');
const EnmapLevel = require('enmap-level');
const klaw = require('klaw');
const path = require('path');
const dbBackend = require('./util/db.js');
require('./modules/Prototypes.js');


class PokeBlob extends Discord.Client {
  constructor(options) {
    super(options);

    this.config = options.config;
    // client.config.token contains the bot's token
    // client.config.prefix contains the message prefix

    // Aliases and commands are put in collections where they can be read from,
    // catalogued, listed, etc.
    this.commands = new Enmap();
    this.aliases = new Enmap();
    this.ratelimits = new Enmap();

    // PostgreSQL database connection
    this.db = new dbBackend(this.config.dbCredentials);

    // Now we integrate the use of Evie's awesome Enhanced Map module, which
    // essentially saves a collection to disk. This is great for per-server configs,
    // and makes things extremely easy for this purpose.
    this.settings = new Enmap({ provider: new EnmapLevel({ name: 'settings' }) });
  }

  /*
  PERMISSION LEVEL FUNCTION

  This is a very basic permission system for commands which uses "levels"
  "spaces" are intentionally left black so you can add them if you want.
  NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
  command including the VERY DANGEROUS `eval` command!

  */
  permlevel(message) {
    let permlvl = 0;

    const permOrder = this.config.permLevels.slice(0).sort((p, c) => p.level < c.level ? 1 : -1);

    while (permOrder.length) {
      const currentLevel = permOrder.shift();
      if (message.guild && currentLevel.guildOnly) continue;
      if (currentLevel.check(message)) {
        permlvl = currentLevel.level;
        break;
      }
    }
    return permlvl;
  }

  log(type, msg, title) {
    if (!title) title = 'Log';
    console.log(`[${type}] [${title}] ${msg}`);
  }

  permCheck(message, perms) {
    if (message.channel.type !== 'text') return;
    return message.channel.permissionsFor(message.guild.me).missing(perms);
  }

  /* 
  COMMAND LOAD AND UNLOAD
  
  To simplify the loading and unloading of commands from multiple locations
  including the index.js load loop, and the reload function, these 2 ensure
  that unloading happens in a consistent manner across the board.
  */

  loadCommand(commandPath, commandName) {
    try {
      const props = new (require(`${commandPath}${path.sep}${commandName}`))(this);
      props.conf.location = commandPath;
      this.log('Log', `Loading Command: ${props.help.name}. 👌`);
      if (props.init) {
        props.init(this);
      }
      this.commands.set(props.help.name, props);
      props.conf.aliases.forEach(alias => {
        this.aliases.set(alias, props.help.name);
      });
      return false;
    } catch (e) {
      return `Unable to load command ${commandName}: ${e}`;
    }
  }

  async unloadCommand(commandPath, commandName) {
    let command;
    if (this.commands.has(commandName)) {
      command = this.commands.get(commandName);
    } else if (this.aliases.has(commandName)) {
      command = this.commands.get(this.aliases.get(commandName));
    }
    if (!command) return `The command \`${commandName}\` doesn"t seem to exist, nor is it an alias. Try again!`;
  
    if (command.shutdown) {
      await command.shutdown(this);
    }
    delete require.cache[require.resolve(`${commandPath}${path.sep}${commandName}.js`)];
    return false;
  }

  /* SETTINGS FUNCTIONS
  These functions are used by any and all location in the bot that wants to either
  read the current *complete* guild settings (default + overrides, merged) or that
  wants to change settings for a specific guild.
  */

  // getSettings merges the client defaults with the guild settings. guild settings in
  // enmap should only have *unique* overrides that are different from defaults.
  getSettings(id) {
    const defaults = this.settings.get('default');
    let guild = this.settings.get(id);
    if (typeof guild !== 'object') guild = {};
    const returnObject = {};
    Object.keys(defaults).forEach((key) => {
      returnObject[key] = guild[key] ? guild[key] : defaults[key];
    });
    return returnObject;
  }
}

// We're doing real fancy node 8 async/await stuff here, and to do that
// we need to wrap stuff in an anonymous function. It's annoying but it works.

const init = async (options) => {

  // This is your client. Some people call it `bot`, some people call it `self`,
  // some might call it `cootchie`. Either way, when you see `client.something`,
  // or `bot.something`, this is what we're refering to. Your client.
  const client = new PokeBlob(options);
  console.log(client.config.permLevels.map(p => `${p.level} : ${p.name}`));

  // Let's start by getting some useful functions that we'll use throughout
  // the bot, like logs and elevation features.
  require('./modules/functions.js')(client);

  // Here we load **commands** into memory, as a collection, so they're accessible
  // here and everywhere else.
  klaw('./commands').on('data', (item) => {
    const file = path.parse(item.path);
    if (!file.ext || file.ext !== '.js') return;
    const response = client.loadCommand(file.dir, `${file.base}`);
    if (response) console.log(response);
  });

  const extendList = [];
  klaw('./extenders').on('data', (item) => {
    const extFile = path.parse(item.path);
    if (!extFile.ext || extFile.ext !== '.js') return;
    try {
      require(`${extFile.dir}${path.sep}${extFile.base}`);
      extendList.push(extFile.name);
    } catch (error) {
      console.log(`Error loading ${extFile.name} extension: ${error}`);
    }
  }).on('end', () => {
    console.log(`[Log] [Log] Loaded a total of ${extendList.length} extensions.`);
  }).on('error', (error) => console.log(error));
  
  const evtFiles = await readdir('./events/');
  client.log('Log', `Loading a total of ${evtFiles.length} events.`);
  evtFiles.forEach(file => {
    const eventName = file.split('.')[0];
    const event = new (require(`./events/${file}`))(client);
    client.on(eventName, (...args) => event.run(...args));
    delete require.cache[require.resolve(`./events/${file}`)];
  });

  client.levelCache = {};
  for (let i = 0; i < client.config.permLevels.length; i++) {
    const thisLevel = client.config.permLevels[i];
    client.levelCache[thisLevel.name] = thisLevel.level;
  }

  // Test the DB connection
  const connection = await client.db.acquire();
  try {
    // checks the connection works, and that the relation exists
    const res = await connection.query('SELECT id FROM guilds');
    client.log('Log', `DB connection test succeeded, returned ${res.rows.length} rows.`);
  } finally {
    connection.release();
  }

  return client;
};

module.exports = init;
