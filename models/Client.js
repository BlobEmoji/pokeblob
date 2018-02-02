
const Discord = require('discord.js');

const Director = require('./database/Director.js');


class Client extends Discord.Client {
  constructor(options) {
    super(options);

    this.db = new Director(options.db);
  }

  async destroy() {
    await super.destroy();
    await this.db.release();
  }
}

module.exports = Client;
