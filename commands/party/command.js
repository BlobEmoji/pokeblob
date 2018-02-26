
const CommandBaseClass = require('../CommandBaseClass.js');

const { MessageEmbed } = require('discord.js');

class Party extends CommandBaseClass {
  constructor(...args) {
    super(...args);

    this.meta = {
      name: 'party',
      category: 'meta.help.categories.pokeblobs',
      description: 'meta.help.commands.party'
    };
  }

  async run(context) {
    const { client, connection, target } = context;

    const userData = await connection.memberData(target);
    const _ = (...x) => client.localize(userData.locale, ...x);
    const _i = (...x) => client.localizeIndex(userData.locale, ...x);

    const party = await connection.getParty(target);

    // make the embed
    const embed = new MessageEmbed()
      .setAuthor(target.user.username, target.user.displayAvatarURL())
      .setTimestamp()
      .setDescription(_('commands.party.description'))
      .setFooter(_('meta.pokeblobs'));

    for (let i = 0; i < 4; i++) {
      const blob = party[i];
      let data = { INDEX: i + 1 };

      if (!blob)
        embed.addField(_('commands.party.slots.empty.title', data), _('commands.party.slots.empty.description', data), true);
      else {
        const lifeStep = Math.floor((blob.health * 10) / blob.vitality);

        data = Object.assign(data, {
          EMOJI: `<:${blob.emoji_name}:${blob.emoji_id}>`,
          NAME: _i('blobs.names', blob.name_potential),
          LEVEL: blob.level,
          HEALTH: blob.health,
          VITALITY: blob.vitality,
          HEALTHBAR: _('commands.party.progress_bar', {
            FILLPART: _('commands.party.fill_character').repeat(lifeStep),
            EMPTYPART: _('commands.party.empty_character').repeat(10 - lifeStep)
          }),
          BESTSTAT: _([
            ['commands.party.stats.attack', blob.attack - (blob.attack_dev / 2)],
            ['commands.party.stats.defense', blob.defense - (blob.defense_dev / 2)],
            ['commands.party.stats.special', blob.special - (blob.special_dev / 2)],
            ['commands.party.stats.speed', blob.speed - (blob.speed_dev / 2)]
          ].sort((a, b) => b[1] - a[1])[0][0]),
          CAPTURETIME: `${blob.party_addition_time.toLocaleString('ja-JP')} UTC` // i could really do without another dependency just for date formatting, ja-JP is nice enough
        });

        embed.addField(_('commands.party.slots.blob.title', data), _('commands.party.slots.blob.description', data), true);
      }
    }

    // send the embed
    await context.send({ embed });
  }
}

module.exports = Party;
