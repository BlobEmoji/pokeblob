
const CommandBaseClass = require('../CommandBaseClass.js');

class Ping extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'ping'
    };
  }

  async run(context) {
    const { message, client } = context;
    let pong = await context.send('Tick,');
    pong = await pong.edit('Tick, tock,');
    await pong.edit('Tick, tock, tick..\n' + 
                    `Recv -> Send: ${pong.createdTimestamp - message.createdTimestamp}ms (+)\n` +
                    `Send -> Edit: ${pong.editedTimestamp - pong.createdTimestamp}ms (=)\n` +
                    `Recv -> Edit: ${pong.editedTimestamp - message.createdTimestamp}ms\n` +
                    `Client Heartbeat: ${Math.round(client.ping)}ms`);
  }
}

module.exports = Ping;
