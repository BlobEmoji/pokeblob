const Command = require('../base/Command.js');

class Trade extends Command {
  constructor(client) {
    super(client, {
      name: 'trade',
      description: 'Trade blobs with a user.',
      category: 'Pokéblob',
      usage: 'trade <your blob> <users blob>',
      guildOnly: true,
      extended: 'Trade one of your blobs for one of another users blobs. This requires the other user to accept the trade.',
      botPerms: ['SEND_MESSAGES'],
      permLevel: 'User'
    });
  }

  async run(message, [mention, yourBlob, usersBlob], level) { // eslint-disable-line no-unused-vars
    const settings = message.settings;
    const correspondent = message.mentions.users.first();
    if (!correspondent)
      return message.channel.send('You must choose someone to trade with!');
    const connection = await this.client.db.acquire();
    try {
      const yourBlobData = await this.client.db.getBlobByName(connection, yourBlob);
      const usersBlobData = await this.client.db.getBlobByName(connection, usersBlob);
      if (!yourBlobData) {
        return message.channel.send('I can\'t work out what blob you\'re trying to trade away (use its full name!).');
      } else if (!usersBlobData) {
        return message.channel.send('I can\'t work out what blob you\'re trying to trade for (use its full name!).');
      }

      const conformers = await this.client.db.checkHasBlobs(connection, message.guild.id, message.author.id, yourBlobData.unique_id, correspondent.id, usersBlobData.unique_id);
      if (conformers.length !== 2) {
        if (conformers.includes(message.author.id)) {
          return message.channel.send('Not engaging a trade because the other user doesn\'t have the blob you want.');
        } else {
          return message.channel.send('Not engaging a trade because you don\'t have the blob you\'re trying to trade away.');
        }
      }

      message.channel.send(`Trading your <:${yourBlobData.emoji_name}:${yourBlobData.emoji_id}> for ${correspondent.tag}'s <:${usersBlobData.emoji_name}:${usersBlobData.emoji_id}>.\nType\`-confirm\` to send a trade request\nType \`-cancel\` to cancel trade.`);
      const filter = m => (m.author.id === message.author.id && [`${settings.prefix}confirm`, `${settings.prefix}cancel`].includes(m.content));
      let response;
      try {
        response = (await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] })).first().content;
      } catch (e) {
        return;
      }
      if (response === `${settings.prefix}confirm`) {
        message.channel.send(`${correspondent} Please confirm trade with ${message.author.tag}. Trading your <:${usersBlobData.emoji_name}:${usersBlobData.emoji_id}> for ${message.author.tag}'s <:${yourBlobData.emoji_name}:${yourBlobData.emoji_id}>`);
        const filter = m => (m.author.id === correspondent.id && [`${settings.prefix}confirm`, `${settings.prefix}cancel`].includes(m.content));
        let response;
        try {
          response = (await message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] })).first().content;
        } catch (e) {
          return;
        }
        if (response === `${settings.prefix}confirm`) {
          await connection.query('BEGIN');

          const takeFromProvider = await this.client.db.takeUserBlob(connection, message.guild.id, message.author.id, yourBlobData.unique_id, 1);
          const takeFromCorrespondent = await this.client.db.takeUserBlob(connection, message.guild.id, correspondent.id, usersBlobData.unique_id, 1);
          await this.client.db.giveUserBlob(connection, message.guild.id, message.author.id, usersBlobData.unique_id, 1);
          await this.client.db.giveUserBlob(connection, message.guild.id, correspondent.id, yourBlobData.unique_id, 1);

          if (!takeFromProvider) {
            await connection.query('ROLLBACK');
            return message.channel.send(`Couldn't trade, ${message.author.tag} doesn't have a <:${yourBlobData.emoji_name}:${yourBlobData.emoji_id}>!`);
          } else if (!takeFromCorrespondent) {
            await connection.query('ROLLBACK');
            return message.channel.send(`Couldn't trade, ${correspondent.tag} doesn't have a <:${usersBlobData.emoji_name}:${usersBlobData.emoji_id}>!`);
          } else {
            await connection.query('COMMIT');
            this.client.log('Log', `A trade has been performed swapping ${message.author.id}'s ${yourBlobData.emoji_name} (${yourBlobData.unique_id}) for ${correspondent.id}'s ${usersBlobData.emoji_name} (${usersBlobData.unique_id}).`, 'Trade');
            return message.channel.send(`Trade between ${message.author.tag} and ${correspondent.tag} confirmed.`);
          }
        } else if (response === `${settings.prefix}cancel`) {
          message.channel.send(`Trade between ${message.author.tag} and ${correspondent.tag} cancelled.`);
        }
      }
    } finally {
      connection.release();
    }
  }
}

module.exports = Trade;
