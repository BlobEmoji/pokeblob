
const CommandBaseClass = require('../CommandBaseClass.js');

class Locale extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'locale',
      category: 'meta.help.categories.meta',
      description: 'meta.help.commands.locale'
    };
  }

  async check(context) {
    return context.member.hasPermission('MANAGE_GUILD');
  }

  async run(context) {
    const { client, connection, args } = context;

    const userData = await context.connection.memberData(context.member);
    const _ = (...x) => client.localize(userData.locale, ...x);

    if (!args)
      return await context.send(_('commands.locale.none'));

    if (args && args.toLowerCase() === userData.locale)
      return await context.send(_('commands.locale.same'));

    try {
      await connection.changeGuildLocale(context.guild.id, args.toLowerCase());
    } catch (e) {
      return await context.send(_('commands.locale.notfound'));
    }

    const message = [_('commands.locale.changed', { PREFIX: context.prefix }), client.localize(args.toLowerCase(), 'commands.locale.changed', { PREFIX: context.prefix })].join('\n\n');
    return await context.send(message);
  }
}

module.exports = Locale;
