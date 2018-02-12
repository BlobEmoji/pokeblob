const Transaction = require('./Transaction.js');


class ConnectionInterfaceBase {
  constructor(connection) {
    this.connection = connection;
    this.activeTransaction = null;
  }

  async query(...args) {
    return await this.connection.query(...args);
  }

  async transaction() {
    if (this.activeTransaction && !this.activeTransaction.complete)
      // transaction is open, probably an accident
      throw new Error('tried to open a transaction twice on the same connectioninterface; open a new connection or use savepoints!');
    
    this.activeTransaction = new Transaction(this.connection);
    await this.activeTransaction.begin();
    return this.activeTransaction;
  }

  async release() {
    if (this.activeTransaction && !this.activeTransaction.complete)
      await this.activeTransaction.rollback();

    return this.connection.release();
  }
}

module.exports = ConnectionInterfaceBase;
