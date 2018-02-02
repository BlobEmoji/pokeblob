const { Pool } = require('pg');

const ConnectionInterface = require('./ConnectionInterface.js');


class Director {
  constructor(credentials) {
    this.pool = new Pool(credentials);
  }

  async acquire() {
    return new ConnectionInterface(await this.pool.connect());
  }

  async release() {
    return await this.pool.end();
  }
}

module.exports = Director;
