
class Transaction {
  constructor(connection) {
    this.connection = connection;
    this.complete = false;
    this.savepoint_count = 0;
  }

  async begin() {
    this.complete = false;
    return await this.connection.query('BEGIN');
  }

  async commit() {
    this.complete = true;
    return await this.connection.query('COMMIT');
  }

  async rollback() {
    this.complete = true;
    return await this.connection.query('ROLLBACK');
  }

  async dispose() {
    if (this.complete)
      return;
    return await this.rollback();
  }

  async savepoint() {
    const savepoint_id = Math.random().toString(36).substring(2);
    const savepoint_name = `savepoint_${savepoint_id}_${this.savepoint_count}`;
    this.savepoint_count++;
    await this.connection.query(`SAVEPOINT "${savepoint_name}"`);
    return savepoint_name;
  }

  async rollbackTo(savepoint_name) {
    return await this.connection.query(`ROLLBACK TO SAVEPOINT "${savepoint_name.replace(/("| )/g, '')}"`);
  }
}

module.exports = Transaction;
