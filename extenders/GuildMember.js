const { Structures } = require('discord.js');

module.exports = Structures.extend('GuildMember', DiscordGuildMember => {
  return class GuildMember extends DiscordGuildMember {

    constructor(...args) {
      super(...args);
      this.fullId = `${this.guild.id}-${this.id}`;
    }

    get inventory() {
      return (async () => {
        const connection = await this.client.db.acquire();
        try {
          return await this.client.db.getUserInventory(connection, this.guild.id, this.id);
        } finally {
          connection.release();
        }
      })();
    }

    get energy() {
      return (async () => {
        const connection = await this.client.db.acquire();
        let data;
        try {
          data = await this.client.db.ensureMember(connection, this.guild.id, this.id);
        } finally {
          connection.release();
        }
        return data.energy;
      })();
    }
  };
});
