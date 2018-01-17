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
          data = await this.client.db.getUserData(connection, this.guild.id, this.id);
        } finally {
          connection.release();
        }
        return data.energy;
      })();
    }

    async giveEnergy(points) {
      const connection = await this.client.db.acquire();
      try {
        return await this.client.db.modifyMemberEnergy(connection, this.guild.id, this.id, points);
      } finally {
        connection.release();
      }
    }

    async takeEnergy(points) {
      const connection = await this.client.db.acquire();
      try {
        return await this.client.db.modifyMemberEnergy(connection, this.guild.id, this.id, -points);
      } finally {
        connection.release();
      }
    }

    async setLevel(level) {
      const score = this.score;
      score.level = level;
      
      const connection = await this.client.db.acquire();
      try {
        return await this.client.db.updateMemberEnergy(connection, this.guild.id, this.id, score);
      } finally {
        connection.release();
      }
    }
  };
});
