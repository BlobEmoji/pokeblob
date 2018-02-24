
const CommandBaseClass = require('../CommandBaseClass.js');

const { MessageEmbed } = require('discord.js');

class User extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'user',
      aliases: ['self', 'inv', 'inventory'],
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.user'
    };
  }

  async run(context) {
    const { client, connection, target } = context;

    const userData = await connection.memberData(target);
    const _ = (...x) => client.localize(userData.locale, ...x);
    const _i = (...x) => client.localizeIndex(userData.locale, ...x);

    const party = await connection.getParty(target);

    let partyDesc = '';

    if (party.length === 0)
      partyDesc = _('commands.user.party.none');
    else {
      const formatted = party.map((x, i) => _('commands.user.party.listing', { INDEX: i + 1, EMOJI: `<:${x.emoji_name}:${x.emoji_id}>`, NAME: _i('blobs.names', x.name_potential) }));
      while (formatted.length !== 0 && partyDesc.length < 400)
        partyDesc += `${formatted.shift()}\n`;
    }

    const items = (await connection.getUserItems(target)).filter(x => x.amount > 0);

    let itemDesc = '';

    if (items.length === 0)
      itemDesc = _('commands.user.items.none');
    else {
      const formatted = items.map((x, i) => _('commands.user.items.listing', { INDEX: i + 1, ITEM: _(x.name, { AMOUNT: x.amount }) }));
      while (formatted.length !== 0 && itemDesc.length < 400)
        itemDesc += `${formatted.shift()}\n`;
    }

    const effects = (await connection.getUserItems(target)).filter(x => x.life > 0);

    let effectDesc = userData.roaming_effect ? `${_('commands.user.effects.roaming')}\n` : '';

    if (effects.length === 0 && effectDesc.length === 0)
      effectDesc = _('commands.user.effects.none');
    else {
      const formatted = effects.map((x, i) => _('commands.user.effects.listing', { INDEX: i + 1, EFFECT: _(x.name), LIFE: x.life }));
      while (formatted.length !== 0 && effectDesc.length < 400)
        effectDesc += `${formatted.shift()}\n`;
    }

    // make the embed
    const embed = new MessageEmbed()
      .setAuthor(target.user.username, target.user.displayAvatarURL())
      .setTimestamp()
      .addField(_('commands.user.party.title'), partyDesc, true)
      .addField(_('commands.user.items.title'), itemDesc, true)
      .addField(_('commands.user.effects.title'), effectDesc, false)
      .setFooter(_('meta.pokeblobs'));

    // send it
    await context.send({ embed });
  }
}

module.exports = User;
