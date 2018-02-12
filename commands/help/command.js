
const CommandBaseClass = require('../CommandBaseClass.js');

const { Collection } = require('discord.js');

class Help extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'help',
      category: 'meta.help.categories.meta',
      description: 'meta.help.commands.help'
    };
  }

  async run(context) {
    const { client } = context;

    const userData = await context.connection.memberData(context.member);
    const _ = (...x) => client.localize(userData.locale, ...x);

    // only show commands the user can do
    const usableCommands = (await Promise.all(client.commands.map(async x => [await x.check(context), x]))).filter(x => x[0]).map(x => x[1]);

    // organize commands into categories
    const categoryBinding = new Collection();
    usableCommands.map(x => [x, x.meta.category ? _(x.meta.category) : _('meta.help.no_category')])
      .map(([x, y]) => categoryBinding.has(y) ? categoryBinding.get(y).push(x) : categoryBinding.set(y, [x]));

    // work out longest line
    const longest = usableCommands.reduce((other, cmd) => Math.max(other, cmd.meta.name), 0);

    // construct into lines
    const outputLines = [`= ${_('meta.help.command_header')} =`];
    [...categoryBinding.entries()].sort().map(([categoryName, categoryCommands]) => {
      outputLines.push(`\n== ${categoryName} ==`);
      categoryCommands.map(x => [x.meta.name, _(x.meta.description)]).sort().map(([x, y]) => {
        outputLines.push(`${context.prefix}${x}${' '.repeat(longest - x.length)} :: ${y}`);
      });
    });

    await context.send(outputLines.join('\n'), { code: 'asciidoc', split: { char: '\n\n' }});
  }
}

module.exports = Help;
