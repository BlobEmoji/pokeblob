
const CommandBaseClass = require('../CommandBaseClass.js');

class Stay extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'stay',
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.stay'
    };
  }

  async run(context) {
    const { client } = context;

    const userData = await context.connection.memberData(context.member);
    const _ = (...x) => client.localize(userData.locale, ...x);

    if (!userData.state_roaming)
      return await context.send(_('commands.roam.off', { PREFIX: context.prefix }));

    await context.connection.updateRoamingState(context.member, false);

    if (userData.roaming_effect)
      return await context.send(_('commands.roam.stop', { PREFIX: context.prefix }));
    else
      return await context.send(_('commands.roam.stop_no_effect', { PREFIX: context.prefix }));
  }
}

module.exports = Stay;
