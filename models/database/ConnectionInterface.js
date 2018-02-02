const Transaction = require('./Transaction.js');


class ConnectionInterface {
  constructor(connection) {
    this.connection = connection;
    this.transaction = null;
  }

  async query(...args) {
    return await this.connection.query(...args);
  }

  async transaction() {
    if (this.transaction && !this.transaction.complete)
      // transaction is open, probably an accident
      throw new Error('tried to open a transaction twice on the same connectioninterface; open a new connection or use savepoints!');
    
    this.transaction = new Transaction(this.connection);
    await this.transaction.begin();
    return this.transaction;
  }

  async release() {
    if (this.transaction && !this.transaction.complete)
      await this.transaction.rollback();

    return this.connection.release();
  }
}

module.exports = ConnectionInterface;
