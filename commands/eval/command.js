
const CommandBaseClass = require('../CommandBaseClass.js');

class Eval extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'eval',
      category: 'meta.help.categories.admin',
      description: 'meta.help.commands.eval'
    };
  }

  async check(context) {
    return this.client.config.admins.includes(context.message.author.id);
  }

  async run(context) {
    if (!context.args)
      return await context.send('You must supply code to execute.');
    const regex = new RegExp('^(?:```(?:js)?\\n+)?([\\s\\S]*?)(?:\\n+```)?$');
    const code = regex.exec(context.args);
    if (!code)
      return await context.send('Code in incompatible format.');

    const lambdaForm = code[1].includes(';') ? `{ ${code[1]} }` : code[1];

    try {
      const evaled = await eval(`(async () => ${lambdaForm})()`);
      return await context.send(`\`\`\`js\n${this.client.clean(evaled)}\n\`\`\``);
    } catch (err) {
      return await context.send(`Error encountered: \`\`\`xl\n${this.client.clean(err)}\n\`\`\``);
    }
  }
}

module.exports = Eval;
