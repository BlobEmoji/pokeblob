const Transaction = require('./Transaction.js');


class ConnectionInterfaceBase {
  constructor(connection) {
    this.connection = connection;
    this.activeTransaction = null;
  }

  async query(...args) {
    return await this.connection.query(...args);
  }

  on(...args) {
    return this.connection.on(...args);
  }

  async transaction() {
    if (this.activeTransaction && !this.activeTransaction.complete)
      // transaction is open, probably an accident
      throw new Error('tried to open a transaction twice on the same connectioninterface; open a new connection or use savepoints!');

    this.activeTransaction = new Transaction(this.connection);
    await this.activeTransaction.begin();
    return this.activeTransaction;
  }

  async disposeTransaction() {
    if (this.activeTransaction)
      await this.activeTransaction.dispose();
  }

  async release() {
    await this.disposeTransaction();

    return this.connection.release();
  }
}

module.exports = ConnectionInterfaceBase;
