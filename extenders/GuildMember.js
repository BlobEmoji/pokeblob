const { Structures } = require('discord.js');

module.exports = Structures.extend('GuildMember', DiscordGuildMember => {
  return class GuildMember extends DiscordGuildMember {

    constructor(...args) {
      super(...args);
    }

  };
});
