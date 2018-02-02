const { Structures } = require('discord.js');

module.exports = Structures.extend('TextChannel', DiscordTextChannel => {
  return class TextChannel extends DiscordTextChannel {

    constructor(...args) {
      super(...args);
    }

  };
});
