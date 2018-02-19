
class CommandBaseClass {
  constructor(client) {
    this.client = client;
  }

  async check() {
    return true;
  }

  async run() {
    throw new Error('Not implemented');
  }
}

module.exports = CommandBaseClass;
