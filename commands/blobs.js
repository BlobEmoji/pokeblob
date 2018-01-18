const Command = require('../base/Command.js');
const { MessageEmbed } = require('discord.js');

class Blobs extends Command {
  constructor(client) {
    super(client, {
      name: 'blobs',
      description: 'Shows the list of blobs you have, and blobs you\'ve seen.',
      category: 'Pokéblob',
      usage: 'blobs',
      guildOnly: true,
      botPerms: ['SEND_MESSAGES'],
      permLevel: 'User'
    });
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    const allArgs = args.join(' ').trim();
    const firstMention = message.mentions.users.first();
    let parseID;
    if (!isNaN(allArgs)) parseID = message.guild.member(allArgs);
    const target = (firstMention) ? firstMention : (parseID) ? parseID.user : message.author;

    const connection = await this.client.db.acquire();
    let blobData;
    try {
      blobData = await this.client.db.getUserBlobs(connection, message.guild.id, target.id);
    } finally {
      connection.release();
    }
    const blobsOwned = blobData.filter(x => x.caught);
    const blobsOnHand = blobsOwned.filter(x => x.amount > 0);
    const blobsOnceOwned = blobsOwned.filter(x => x.amount <= 0);
    const blobsSeen = blobData.filter(x => !x.caught);

    const onHandFormatting = blobsOnHand.slice(0, 18).map(x => x.amount > 1 ? `${x.amount}x <:${x.emoji_name}:${x.emoji_id}>` : `<:${x.emoji_name}:${x.emoji_id}>`).join(', ') + (blobsOnHand.length > 18 ? '...' : '');
    const onceOwnedFormatting = blobsOnceOwned.slice(0, 18).map(x => `<:${x.emoji_name}:${x.emoji_id}>`).join(', ') + (blobsOnceOwned.length > 18 ? '...' : '');
    const seenFormatting = blobsSeen.slice(0, 18).map(x => `<:${x.emoji_name}:${x.emoji_id}>`).join(', ') + (blobsSeen.length > 18 ? '...' : '');

    const embed = new MessageEmbed()
      .setAuthor(target.username, target.displayAvatarURL())
      .setTimestamp()
      .setDescription(`This user has seen ${blobData.length} blob(s) in their lifetime.`)
      .setFooter('PokéBlobs');

    if (onHandFormatting.trim() !== '')
      embed.addField(`Blobs owned on hand (${blobsOnHand.length})`, onHandFormatting, false);
    if (onceOwnedFormatting.trim() !== '')
      embed.addField(`Blobs once owned, but traded away (${blobsOnceOwned.length})`, onceOwnedFormatting, false);
    if (seenFormatting.trim() !== '')
      embed.addField(`Blobs seen on adventure (${blobsSeen.length})`, seenFormatting, false);

    message.channel.send({ embed });
  }
}

module.exports = Blobs;
