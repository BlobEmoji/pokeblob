
const CommandBaseClass = require('../CommandBaseClass.js');

class Roam extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'roam',
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.roam'
    };
  }

  async run(context) {
    const { message, client } = context;

    const userData = await context.connection.memberData(context.member);
    const _ = (...x) => context.client.localize(userData.locale, ...x);

    if (userData.state[0] === '1')
      return await context.send(_('commands.roam.on', { PREFIX: context.prefix }));

    await context.connection.updateRoamingState(context.member, true);

    if (userData.energy === 0)
      return await context.send(_('commands.roam.out', { PREFIX: context.prefix }));
    else
      return await context.send(_('commands.roam.start', { PREFIX: context.prefix }));
  }
}

module.exports = Roam;
