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
      botPerms: ['EMBED_LINKS', 'SEND_MESSAGES'],
      permLevel: 'User'
    });
  }

  async run(message, [mode, memberID], level) { // eslint-disable-line no-unused-vars
    const firstMention = message.mentions.users.first();
    let parseID;
    if (!isNaN(memberID)) parseID = message.guild.member(memberID);
    // if someone puts in just the member ID
    if (!parseID && !isNaN(mode)) parseID = message.guild.member(mode);
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

    const embed = new MessageEmbed()
      .setAuthor(target.username, target.displayAvatarURL())
      .setTimestamp()
      .setDescription(`This user has seen ${blobData.length} blob(s) in their lifetime.`)
      .setFooter('PokéBlobs');
    
    switch (mode) {
      case ('rarity'): {
        const legendaryBlobs = blobsOnHand.filter(x => x.rarity === 1);
        const rareBlobs = blobsOnHand.filter(x => x.rarity === 2);
        const uncommonBlobs = blobsOnHand.filter(x => x.rarity === 3);
        const commonBlobs = blobsOnHand.filter(x => x.rarity === 4);

        if (legendaryBlobs.length > 0)
          embed.addField(`Legendary (${legendaryBlobs.length})`, this.trimFormat(legendaryBlobs), false);
        if (rareBlobs.length > 0)
          embed.addField(`Rare (${rareBlobs.length})`, this.trimFormat(rareBlobs), false);
        if (uncommonBlobs.length > 0)
          embed.addField(`Uncommon (${uncommonBlobs.length})`, this.trimFormat(uncommonBlobs), false);
        if (commonBlobs.length > 0)
          embed.addField(`Common (${commonBlobs.length})`, this.trimFormat(commonBlobs), false);

        return message.channel.send({ embed });
      }

      default: {
        if (blobsOnHand.length > 0)
          embed.addField(`Blobs owned on hand (${blobsOnHand.length})`, this.trimFormat(blobsOnHand), false);
        if (blobsOnceOwned.length > 0)
          embed.addField(`Blobs once owned, but traded away (${blobsOnceOwned.length})`, this.trimFormat(blobsOnceOwned), false);
        if (blobsSeen.length > 0)
          embed.addField(`Blobs seen on adventure (${blobsSeen.length})`, this.trimFormat(blobsSeen), false);

        return message.channel.send({ embed });
      }
    }
  }

  trimFormat(collection) {
    return collection.slice(0, 18).map(x => x.amount > 1 ? `${x.amount}x <:${x.emoji_name}:${x.emoji_id}>` : `<:${x.emoji_name}:${x.emoji_id}>`).join(', ') + (collection.length > 18 ? '...' : '');
  }
}

module.exports = Blobs;
