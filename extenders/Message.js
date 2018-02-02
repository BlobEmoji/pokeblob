const { Structures } = require('discord.js');

module.exports = Structures.extend('Message', DiscordMessage => {
  return class Message extends DiscordMessage {

    constructor(...args) {
      super(...args);
    }

  };
});
