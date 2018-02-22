
const CommandBaseClass = require('../CommandBaseClass.js');

const { MessageEmbed } = require('discord.js');

class Blobs extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'blobs',
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.blobs'
    };
  }

  async run(context) {
    const { client, connection, target } = context;

    const userData = await connection.memberData(target);
    const _ = (...x) => client.localize(userData.locale, ...x);
    const _i = (...x) => client.localizeIndex(userData.locale, ...x);

    const blobs = await connection.getUserBlobs(target);
    const party = blobs.filter(x => x.in_party);
    const stored = blobs.filter(x => !x.in_party);

    let partyDesc = '';
    let storedDesc = '';

    if (party.length === 0)
      partyDesc = _('commands.blobs.none_party');
    else {
      const formatted = party.map((x, i) => _('commands.blobs.display_format.party', { INDEX: i + 1, EMOJI: `<:${x.emoji_name}:${x.emoji_id}>`, NAME: _i('blobs.names', x.name_potential) }));
      while (formatted.length !== 0 && partyDesc.length < 400)
        partyDesc += `${formatted.shift()}\n`;
      if (formatted.length > 0)
        partyDesc += _('commands.blobs.extra', { AMOUNT: formatted.length });
    }

    if (stored.length === 0)
      storedDesc = _('commands.blobs.none_storage');
    else {
      const formatted = stored.map((x, i) => _('commands.blobs.display_format.stored', { INDEX: i + 1, EMOJI: `<:${x.emoji_name}:${x.emoji_id}>`, NAME: _i('blobs.names', x.name_potential) }));
      while (formatted.length !== 0 && storedDesc.length < 400)
        storedDesc += `${formatted.shift()}\n`;
      if (formatted.length > 0)
        storedDesc += _('commands.blobs.extra', { AMOUNT: formatted.length });
    }

    // make the embed
    const embed = new MessageEmbed()
      .setAuthor(target.user.username, target.user.displayAvatarURL())
      .setTimestamp()
      .addField(_('commands.blobs.title.party'), partyDesc, true)
      .addField(_('commands.blobs.title.storage'), storedDesc, true)
      .setFooter(_('meta.pokeblobs'));

    // send it
    await context.send({ embed });
  }
}

module.exports = Blobs;
