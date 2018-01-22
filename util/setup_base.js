const config = {
  // Bot Owner, level 10 by default. You no longer need to supply the owner ID, as the bot
  // will pull this information directly from it's application page.
  
  // Your Bot's Token. Available on https://discordapp.com/developers/applications/me
  'token': '{{token}}',

  // Default per-server settings. These settings are entered in a database on first load, 
  // And are then completely ignored from this file. To modify default settings, use the `conf` command.
  // DO NOT REMOVE THIS BEFORE YOUR BOT IS LOADED AND FUNCTIONAL.

  'defaultSettings' : {
    'prefix': '-',
    'modLogChannel': 'mod-log',
    'councilRole': 'Blob Council',
    'policeRole': 'Blob Police',
    'systemNotice': 'true',
    'minPoints': 5,
    'maxPoints': 1000
  },

  'dbCredentials': {
    'user': 'example_user',
    'host': 'localhost',
    'database': 'example_database',
    'password': '',
    'port': 5432
  },

  // PERMISSION LEVEL DEFINITIONS.

  permLevels: [
    // This is the lowest permisison level, this is for non-roled users.
    { level: 0,
      name: 'User', 
      // Don't bother checking, just return true which allows them to execute any command their
      // level allows them to.
      check: () => true
    },

    { level: 3,
      name: 'Blob Council', 
      check: (message) => {
        try {
          const councilRole = message.guild.roles.find(r => r.name.toLowerCase() === message.settings.councilRole.toLowerCase());
          return (councilRole && message.member.roles.has(councilRole.id));
        } catch (e) {
          return false;
        }
      }
    },
    // Bot Admin has some limited access like rebooting the bot or reloading commands.
    { level: 9,
      name: 'Blob Police', 
      check: (message) => {
        try {
          const policeRole = message.guild.roles.find(r => r.name.toLowerCase() === message.settings.policeRole.toLowerCase());
          return (policeRole && message.member.roles.has(policeRole.id));
        } catch (e) {
          return false;
        }
      }
    },
    // This is the bot owner, this should be the highest permission level available.
    // The reason this should be the highest level is because of dangerous commands such as eval
    // or exec (if the owner has that).
    { level: 10,
      name: 'Bot Owner', 
      // Another simple check, compares the message author id to the one stored in the config file.
      check: (message) => message.client.appInfo.owner.id === message.author.id
    }
  ]
};

module.exports = config;
