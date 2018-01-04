const Command = require('../base/Command.js');

class Score extends Command {
  constructor(client) {
    super(client, {
      name: 'score',
      description: 'Displays your current points.',
      usage: 'score',
      category: 'Economy',
      aliases: ['points', 'bal', 'balance'],
      botPerms: ['SEND_MESSAGES'],
      permLevel: 'User'
    });
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    const member = args[0] ? await this.verifyMember(message, args[0]) : message.member;
    const score = member.score;
    message.channel.send(`You currently have ${score.points}`);
  }
}

module.exports = Score;