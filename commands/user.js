const Command = require('../base/Command.js');
const { MessageEmbed } = require('discord.js');

class User extends Command {
  constructor(client) {
    super(client, {
      name: 'user',
      description: 'Display info on a user.',
      category: 'Pokéblob',
      usage: 'user <id>',
      aliases: ['inv', 'inventory'],
      guildOnly: true,
      botPerms: ['EMBED_LINKS', 'SEND_MESSAGES'],
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
    let userData, inventory, blobData, effectData;
    try {
      userData = await this.client.db.ensureMember(connection, message.guild.id, target.id);
      inventory = await this.client.db.getUserInventory(connection, message.guild.id, target.id);
      blobData = await this.client.db.getUserBlobs(connection, message.guild.id, target.id);
      effectData = await this.client.db.getUserEffects(connection, message.guild.id, target.id);
    } finally {
      connection.release();
    }
    let invFormatting = inventory.filter(x => x.amount > 0).map(x => `${x.amount}x ${x.name}`).join(', ');
    const blobsOwned = blobData.filter(x => x.caught);
    const blobsOnHand = blobsOwned.filter(x => x.amount > 0);
    const blobFormatting = blobsOnHand.slice(0, 5).map(x => `${x.amount}x <:${x.emoji_name}:${x.emoji_id}>`).join(', ') + (blobsOnHand.length > 5 ? '...' : '');
    if (invFormatting === '') invFormatting = 'Empty';
    let effectFormatting = effectData.filter(x => x.life > 0).map(x => `${x.name} (${x.life})`).join(', ');
    if (effectFormatting === '') effectFormatting = 'None';
    const embed = new MessageEmbed()
      .setAuthor(target.username, target.displayAvatarURL())
      .setTimestamp()
      .addField('Member Energy', `${userData.energy}`, true)
      .addField('Inventory', `${invFormatting}`, true)
      .addField('Blobs On Hand', `${blobFormatting}\n${blobsOnHand.length} on hand (${blobsOwned.length} ever owned, ${blobData.length} seen)`, true)
      .addField('Coins', `${userData.currency}`, true)
      .addField('Effects', `${effectFormatting}`, true)
      .setFooter('PokéBlobs');
    message.channel.send({ embed });
  }
}

module.exports = User;
