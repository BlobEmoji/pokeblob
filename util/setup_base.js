const roles = require('./config.js');

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
    'traineeRole': 'Council Trainee',
    'councilRole': 'Blob Council',
    'policeRole': 'Blob Police',
    'systemNotice': 'true',
    'blobCoin': '398579309276823562'
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

    // This is your permission level, the staff levels should always be above the rest of the roles.
    { level: 2,
      // This is the name of the role.
      name: 'Trainee',
      // The following lines check the guild the message came from for the roles.
      // Then it checks if the member that authored the message has the role.
      // If they do return true, which will allow them to execute the command in question.
      // If they don't then return false, which will prevent them from executing the command.
      check: (message) => {
        return message.member.roles.has(roles.traineeRole);
      }
    },

    { level: 3,
      name: 'Council', 
      check: (message) => {
        return message.member.roles.has(roles.councilRole);
      }
    },
    // Bot Admin has some limited access like rebooting the bot or reloading commands.
    { level: 9,
      name: 'Police', 
      check: (message) => {
        return message.member.roles.has(roles.policeRole);
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